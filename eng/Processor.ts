import { JsonSchema, SerialValue } from "../lib/CoreTypings";
import { castToString, isRecord } from "../lib/EvalCasting";
import { LLMInstruction } from "../lib/LLMTypes";
import { isBlank, smoosh } from "../lib/TextHelpers";
import {
  Act,
  ACTS,
  ActSchema,
  cleanSpokenText,
  contextReadable,
  EmbeddedSegment,
  ENGINE,
  LLMYieldFunc,
  RawInputShape,
  StoryEvent,
  StoryEventContext,
  StoryEventType,
} from "./Helpers";

export type ParsedMessageSpec = {
  act: Act;
  to: string[];
  value: string;
  raw: string;
};

const ConditionalResultSchema: JsonSchema = {
  type: "object",
  properties: {
    result: { type: "boolean" },
  },
  required: ["result"],
  additionalProperties: false,
};

export function reifyMessageSpec(partial: Partial<RawInputShape>): ParsedMessageSpec {
  return {
    act: "dialog",
    to: [],
    value: "",
    raw: "",
    ...partial,
  };
}

export function reifyMessageFromText(text: string, others: Partial<RawInputShape>): ParsedMessageSpec {
  return reifyMessageSpec({ raw: text, value: text, ...others });
}

export const rawInputToPartialMessage = async (
  input: RawInputShape,
  ctx: StoryEventContext,
  doUseLLM: boolean = true,
): Promise<ParsedMessageSpec[]> => {
  // If we already got a full parsed message, just return it
  if (input.type && input.act && input.to && input.value) {
    return [input as ParsedMessageSpec];
  }

  const trimmed = input.raw.trim();
  if (isBlank(trimmed)) {
    const spec: ParsedMessageSpec = {
      act: "unknown",
      to: [],
      value: "",
      ...input,
    };
    return [spec];
  }

  // Check for fast paths we can return early for
  const clean = smoosh(trimmed.toLowerCase()).replace(/[.,!?;:'"]/g, "");
  if (clean === "quit game" || clean === "stop game" || clean === "exit game")
    return [
      reifyMessageFromText("quit game", {
        to: [ENGINE],
        act: "command",
      }),
    ];
  if (clean === "save game")
    return [
      reifyMessageFromText("save game", {
        to: [ENGINE],
        act: "command",
      }),
    ];
  if (clean === "restart game" || clean === "replay game")
    return [
      reifyMessageFromText("restart game", {
        to: [ENGINE],
        act: "command",
      }),
    ];
  if (clean === "pause game")
    return [
      reifyMessageFromText("pause game", {
        to: [ENGINE],
        act: "command",
      }),
    ];

  // If LLM use is off *or* we have a single word text, let's assume it's dialog.
  if (!doUseLLM || !!clean.match(/^\S+$/)) {
    input = {
      to: [], // By default assume we send to "everyone" as a catchall
      value: input.raw.trim(),
      act: "dialog",
      ...input,
    };
    const messages = ctx.session.history.filter((m) => m.type === StoryEventType.$message);
    const last = messages[messages.length - 1];
    if (last) {
      if (last.to.includes(input.from)) {
        // If the last message was to us, assume we are responding to them
        input.to?.push(last.from);
      } else if (last.from === input.from) {
        // If the last message was from us, assume the same recipient
        input.to?.push(...last.to);
      }
    }
    return [reifyMessageSpec(input)];
  }

  return llmRawInputToMessages(input, ctx);
};

type ParsedEventEnvelope = {
  events: Array<{
    act: Act;
    to: string[];
    value: string;
    raw: string;
  }>;
};

const ParsedEventEnvelopeSchema: JsonSchema = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          act: { type: "string", enum: [...ACTS] },
          to: { type: "array", items: { type: "string" } },
          value: { type: "string" },
          raw: { type: "string" },
        },
        required: ["act", "to", "value", "raw"],
        additionalProperties: false,
      },
    },
  },
  required: ["events"],
  additionalProperties: false,
};

const MAX_RECENT = 10;

export const buildContextSnapshot = (ctx: StoryEventContext, maxRecentEvents: number = MAX_RECENT): SerialValue => {
  const messages = ctx.session.history
    .slice(-maxRecentEvents)
    .filter((e) => e.type === StoryEventType.$message)
    .map((e) => ({
      act: e.act,
      from: e.from,
      to: e.to,
      value: e.value,
      // We may want the processed result value if we did like enum matching or something
      // result: e.result,
    }));

  return {
    player: { id: ctx.session.player.id, label: ctx.session.player.label },
    messages,
    // I'm not sure if we really need the state here, so omitting for now.
    // state: contextReadable(ctx),
  };
};

function formatActDefs(): string {
  return ActSchema.options.map((opt) => `${opt.value}: ${opt.description}`).join("\n");
}

const rawInputToInstructions = (input: RawInputShape, snapshot: SerialValue): LLMInstruction[] => {
  const { from, raw } = input;
  const contextJson = JSON.stringify(snapshot, null, 2);
  const actDefs = formatActDefs();

  const system = [
    "Parse player input into semantic events for an interactive fiction engine.",
    "",
    "ACT TYPES:",
    actDefs,
    "",
    "RULES:",
    `- Split input into ordered events; set 'to' to entity ids or "${ENGINE}" for meta/commands`,
    "- 'value' = normalized text, 'raw' = exact input fragment",
    "",
    "EXAMPLES:",
    ...EXAMPLES.map(({ input, events }) => `"${input}" => ${JSON.stringify(events)}`),
  ].join("\n");

  const user = [
    `FROM: ${from}`,
    `INPUT: ${raw}`,
    "",
    "CONTEXT:",
    contextJson,
    "",
    `Output JSON: {"events":[{"act":"<act>","to":["<id>"],"value":"<text>","raw":"<fragment>"},...]}`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
};

export const llmRawInputToMessages = async (
  raw: RawInputShape,
  ctx: StoryEventContext,
): Promise<ParsedMessageSpec[]> => {
  const snapshot = await buildContextSnapshot(ctx);
  const instructions = rawInputToInstructions(raw, snapshot);
  const parsed = (await ctx.io({
    kind: "llm",
    instructions,
    schema: ParsedEventEnvelopeSchema,
    models: [],
  })) as ParsedEventEnvelope | null;
  console.info("[input] raw->LLM->messages", {
    raw,
    parsed: JSON.stringify(parsed),
  });
  if (!parsed) {
    return [];
  }
  return parsed.events.map((e) => ({
    act: e.act,
    from: raw.from,
    to: e.to && e.to.length > 0 ? e.to : [ENGINE],
    value: e.value,
    raw: e.raw ?? raw.raw,
  }));
};

type ExampleEvent = Pick<ParsedMessageSpec, "act" | "to" | "value" | "raw">;

const EXAMPLES: { input: string; events: ExampleEvent[] }[] = [
  {
    input: "Go west",
    events: [
      {
        act: "command",
        to: [ENGINE],
        value: "go west",
        raw: "Go west",
      },
    ],
  },
  {
    input: "What do I know about this symbol?",
    events: [
      {
        act: "query",
        to: [ENGINE],
        value: "what do I know about this symbol?",
        raw: "What do I know about this symbol?",
      },
    ],
  },
  {
    input: "What time is it?",
    events: [
      {
        act: "query",
        to: [ENGINE],
        value: "what time is it?",
        raw: "What time is it?",
      },
    ],
  },
  {
    input: "John sighs and pockets the key.",
    events: [
      {
        act: "dialog",
        to: [ENGINE],
        value: "John sighs and pockets the key.",
        raw: "John sighs and pockets the key.",
      },
    ],
  },
  {
    input: "Doctor, my knee hurts.",
    events: [
      {
        act: "dialog",
        to: ["<entity-id-for-Doctor>"],
        value: "My knee hurts.",
        raw: "Doctor, my knee hurts.",
      },
    ],
  },
  {
    input: "Tell Bob and John to go away",
    events: [
      {
        act: "dialog",
        to: ["<entity-id-for-Bob>", "<entity-id-for-John>"],
        value: "Go away!",
        raw: "Tell Bob to go away",
      },
    ],
  },
  {
    input: "Handle the doctor however you want.",
    events: [
      {
        act: "command",
        to: [ENGINE],
        value: "handle the doctor however you want",
        raw: "Handle the doctor however you want.",
      },
    ],
  },
  {
    input: "What would happen if I threatened the guard?",
    events: [
      {
        act: "query",
        to: [ENGINE],
        value: "What would happen if I threatened the guard?",
        raw: "What would happen if I threatened the guard?",
      },
    ],
  },
  {
    input: "Save the game",
    events: [
      {
        act: "command",
        to: [ENGINE],
        value: "save game",
        raw: "Save the game",
      },
    ],
  },
  {
    input: "use shorter descriptions from now on",
    events: [
      {
        act: "preference",
        to: [ENGINE],
        value: "use shorter descriptions",
        raw: "Use shorter descriptions from now on",
      },
    ],
  },
  {
    input: "Bob, could you repeat what you said earlier?",
    events: [
      {
        act: "query",
        to: ["<entity-id-for-Bob>"],
        value: "repeat what you said earlier",
        raw: "Bob, could you repeat what you said earlier?",
      },
    ],
  },
  {
    input: "get to the chopper!",
    events: [
      {
        act: "dialog",
        to: ["<other-player-character-id>"],
        value: "get to the chopper!",
        raw: "get to the chopper!",
      },
    ],
  },
  {
    input: "please save the game, then tell Bob to go away. then go west",
    events: [
      {
        act: "command",
        to: [ENGINE],
        value: "save game",
        raw: "please save the game",
      },
      {
        act: "dialog",
        to: ["<entity-id-for-Bob>"],
        value: "Go away!",
        raw: "tell Bob to go away",
      },
      {
        act: "command",
        to: [ENGINE],
        value: "go west",
        raw: "go west",
      },
    ],
  },
];

function formatScreenplay(events: StoryEvent[]): string {
  return events
    .filter((e) => e.type === StoryEventType.$message && e.value)
    .map((e) => `${e.from}: ${e.value}`)
    .join("\n");
}

export async function generateDialogue(
  ctx: StoryEventContext,
  speaker: string,
  segments: EmbeddedSegment[],
  persona: string,
  history: StoryEvent[],
  models: string[] = ["WRITING"],
): Promise<string> {
  const prompts = segments.filter((s) => s.kind === "prompt");
  if (!prompts.length) {
    return segments.map((s) => s.value).join("\n");
  }

  const resolveModels = (seg: EmbeddedSegment & { kind: "prompt" }): string[] => {
    const m = castToString(seg.params.model ?? "");
    return isBlank(m) ? models : [m];
  };

  const hasText = segments.some((s) => s.kind === "text");
  const screenplay = formatScreenplay(history);

  if (!hasText) {
    const prompt = prompts.map((s) => s.value).join("\n");
    const segModels = resolveModels(prompts[0]);
    const fullPersona = persona ? `${persona}\n\n${prompt}` : prompt;
    const instructions = [
      {
        role: "system" as const,
        content: [
          `You are writing dialogue for ${speaker}. Here is their persona:`,
          fullPersona,
          "",
          "Write a single spoken line. No stage directions, no quotation marks, no formatting.",
          "Keep it natural and concise.",
        ].join("\n"),
      },
      {
        role: "user" as const,
        content: screenplay ? `[Prior conversation]\n${screenplay}\n\n${speaker}:` : `${speaker}:`,
      },
    ];
    const result = await ctx.llm(instructions, {}, { models: segModels });
    return cleanSpokenText(castToString(result ?? ""));
  }

  const parts: string[] = [];
  for (const seg of segments) {
    if (seg.kind === "text") {
      parts.push(cleanSpokenText(seg.value));
      continue;
    }
    const segModels = resolveModels(seg);
    const before = parts.join(" ").trim();
    const after = segments
      .slice(segments.indexOf(seg) + 1)
      .filter((s) => s.kind === "text")
      .map((s) => s.value)
      .join(" ");
    const ctx_lines: string[] = [];
    if (persona) ctx_lines.push(persona, "");
    ctx_lines.push(`You are writing dialogue for ${speaker}.`);
    if (before) ctx_lines.push(`The preceding dialogue is: "${before}"`);
    if (after) ctx_lines.push(`The following dialogue is: "${after}"`);
    ctx_lines.push("", seg.value);
    ctx_lines.push("", "Write ONLY the generated portion. No stage directions, no quotation marks, no formatting.");
    ctx_lines.push("Keep it natural, concise, and flowing with the surrounding text.");
    const instructions = [
      { role: "system" as const, content: ctx_lines.join("\n") },
      {
        role: "user" as const,
        content: screenplay ? `[Prior conversation]\n${screenplay}\n\n${speaker}:` : `${speaker}:`,
      },
    ];
    const result = await ctx.llm(instructions, {}, { models: segModels });
    parts.push(cleanSpokenText(castToString(result ?? "")));
  }
  return parts.join(" ");
}

export function createLLMYieldIfFunc(ctx: StoryEventContext): LLMYieldFunc {
  return async function evalLlmConditional(frag: string) {
    const info = gatherContextInfo(ctx);
    const instructions = llmConditionalToInstructions(frag, info);
    const raw = await ctx.llm(instructions, ConditionalResultSchema, { models: [] });
    const result = unwrapConditionalResult(raw as SerialValue);
    if (result !== null) {
      return result;
    }
    return false;
  };
}

export function simplifyEvent(event: StoryEvent) {
  return {
    type: event.type,
    from: event.from,
    to: event.to,
    obs: event.obs,
    excl: event.excl,
    raw: event.raw,
    value: event.value,
    result: event.result,
    url: event.url,
  };
}

export function simplifyMessage(event: StoryEvent) {
  return {
    from: event.from,
    to: event.to,
    obs: event.obs,
    excl: event.excl,
    value: event.value,
    result: event.result,
  };
}

export function gatherContextInfo(
  ctx: StoryEventContext,
  filter: (event: StoryEvent) => boolean = () => true,
  retention: number = 1000,
) {
  const state = contextReadable(ctx);
  const { player } = ctx.session;
  const event = simplifyEvent(ctx.event);
  const input = event.type === StoryEventType.$input_final ? event : null;
  const entities = Object.keys(ctx.session.entities).map((name) => {
    const { stats, persona } = ctx.session.entities[name];
    return {
      name,
      persona,
      stats,
    };
  });
  const history = ctx.session.history
    .filter((event) => event.type === StoryEventType.$message)
    .filter(filter)
    .slice(-retention)
    .map(simplifyMessage);
  return {
    state,
    input,
    entities,
    player,
    history,
  };
}

function llmConditionalToInstructions(
  condition: string,
  context: ReturnType<typeof gatherContextInfo>,
): LLMInstruction[] {
  const contextJson = JSON.stringify(context, null, 2);
  const system = [
    "You evaluate a story condition for an interactive fiction engine.",
    "Use only the provided context and decide if the condition is true right now.",
    "Treat unknown or insufficient evidence as false.",
    'Return ONLY JSON matching this schema: {"result": boolean}.',
  ].join("\n");
  const user = [`CONDITION: ${condition.trim()}`, "", "CONTEXT:", contextJson].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function unwrapConditionalResult(value: SerialValue): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0 && !isNaN(value);
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
    return null;
  }
  if (isRecord(value)) {
    const result = value.result;
    if (typeof result === "boolean") {
      return result;
    }
    if (typeof result === "number") {
      return result !== 0 && !isNaN(result);
    }
    if (typeof result === "string") {
      const normalized = result.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }
      if (normalized === "false") {
        return false;
      }
    }
  }
  return null;
}
