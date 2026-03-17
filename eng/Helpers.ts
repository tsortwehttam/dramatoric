import z from "zod";
import { ErrorBase, JsonSchema, NestedRecords, NonEmpty, SerialValue } from "../lib/CoreTypings";
import { BlendStrategy } from "../lib/NPC";
import { castToString, isVarPath } from "../lib/EvalCasting";
import { isValidUrl } from "../lib/HTTPHelpers";
import { LLM_SLUGS, LLMInstruction } from "../lib/LLMTypes";
import { parseNumberOrNull } from "../lib/MathHelpers";
import { PRNG } from "../lib/RandHelpers";
import { readTemplateToken } from "../lib/TemplateHelpers";
import { isBlank, ulid } from "../lib/TextHelpers";
import { StoryVoiceSpec } from "../lib/VoiceHelpers";
import { ExprEvalFunc } from "./Evaluator";
import {
  KVP_DELIM,
  LexerToken,
  looksLikeScriptExpression,
  tokenize,
  tokensToScalarValue,
  trimTokenSpaces,
} from "./Lexer";

export const WellVarBindingSchema = z.object({
  name: z.string(),
  type: z.union([z.literal("val"), z.literal("arr")]),
});

export type WellVarBinding = z.infer<typeof WellVarBindingSchema>;

type WellNodeShape = {
  type: string;
  args: string;
  kids: WellNodeShape[];
  vars: WellVarBinding[];
  eave: string;
};

export const WellNodeSchema: z.ZodType<WellNodeShape> = z.lazy(() =>
  z.object({
    type: z.string(),
    args: z.string(),
    kids: z.array(WellNodeSchema),
    vars: z.array(WellVarBindingSchema),
    eave: z.string(),
  }),
);

export type WellNode = z.infer<typeof WellNodeSchema>;

export function dumpNode(node: WellNode, indent = "", max: number = 80): string {
  const parts: string[] = [];
  const varsStr = node.vars.length
    ? ` [${node.vars.map((v) => v.name + (v.type === "arr" ? "[]" : "")).join(", ")}]`
    : "";
  const eaveStr = node.eave ? ` |${node.eave}|` : "";
  const argsPreview = node.args.slice(0, max) + (node.args.length > max ? "..." : "");
  const header =
    node.type === TEXT_TYPE
      ? `"${node.args.slice(0, max)}${node.args.length > max ? "..." : ""}"`
      : node.args
        ? `${node.type}${varsStr}${eaveStr}: ${argsPreview}`
        : `${node.type}${varsStr}${eaveStr}`;
  parts.push(`${indent}${header}`);
  for (const kid of node.kids) {
    parts.push(dumpNode(kid, indent + "  "));
  }
  return parts.join("\n");
}

export function cloneNode(node: WellNode): WellNode {
  return {
    type: node.type,
    args: node.args,
    kids: node.kids.map(cloneNode),
    vars: node.vars.map((v) => ({ ...v })),
    eave: node.eave,
  };
}

export type StoryMeta = {
  voices: Record<string, Partial<StoryVoiceSpec>>;
  pronunciations: Record<string, string>;
  scripts: NestedRecords;
} & Record<string, SerialValue>;

export type StorySources = {
  root: WellNode;
  meta: StoryMeta;
  errs: ErrorBase[];
};

export const ENGINE_EVENT_PREFIX = "$";

export enum StoryEventType {
  $none = "$none", // Sentinel / no-op. Useful as a default value or placeholder where an event type is required but no real event has occurred.
  $init = "$init", // Engine or story system has been initialized, but no specific game/session has started yet. One-time bootstrap hook.
  $start = "$start", // A new game/session has started. Used to kick off initial world state, scripts, intro scenes, etc.
  $resume = "$resume", // An existing game/session has been resumed from a save or snapshot. Used to rehydrate state and resume flows.
  $boot = "$boot", // Request to restart the engine with a new session. Used by BOOT directive to signal that the current engine should be torn down and recreated.
  $exit = "$exit", // Marks the end of the story. Used to signal that the story has completed.
  $save = "$save", // The game session save function will be called
  $input_chunk = "$input_chunk", // Partial raw input (e.g. streaming ASR transcript chunk or partial text). No semantics yet; this is just transport from the input adapter.
  $input_final = "$input_final", // Completed input turn (e.g. full ASR transcript or final text). This is what the LLM/parse pipeline consumes to emit one or more $message events.
  $message = "$message", // Canonical semantic message type representing a single interpreted intent or act - world command, dialog, narration, meta command, query, etc. Meaning is determined by channel + act + from + to, not by this type alone.
  $media = "$media", // Non-text media destined for the renderer/client: sound effects, music, images, animations, etc. Payload is carried in the event's media fields.
  $wait = "$wait", // Tell the client to wait for a period of time for e.g. dramatic effect
  $entity = "$entity", // An entity's stats or persona changed. Carries the entity name in `from` and changed fields in `result`.
}

export const ActSchema = z.union([
  z.literal("command").describe("System-level commands like 'save game', 'restart chapter', 'pause the game'"),
  z.literal("dialog").describe("In-world spoken dialog like 'give me that torch or else!'; also narration"),
  z.literal("query").describe("Query about in-world state like 'what is my inventory', 'describe the monster'"),
  z.literal("preference").describe("User preference settings or configuration 'turn volume down'"),
  z.literal("system").describe("Engine or system-level events and processing like $input_chunk or $boot"),
  z.literal("media").describe("Music, sound-effect or cue (diegetic or non-diegetic)"),
  z.literal("choice").describe("Player story choice like 'go west', 'choose the sword'"),
  z.literal("authoring").describe("Story-creation like 'make a sci fi story', 'this is a game about...'"),
  z.literal("multiplayer").describe("Multiplayaer conversation like 'how about we restart!'; also spectator comments"),
  z.literal("thought").describe("Internal thinking by engine or NPC to help determine story logic; invisible to NPCs"),
  z.literal("info").describe("Generic bucket for information/data useful to story execution, for engine LLM"),
  z.literal("unknown"),
]);

export type Act = z.infer<typeof ActSchema>;
export const ACTS = ActSchema.options.map((opt) => opt.value);

export type Channel = "input" | "output" | "emit" | "engine" | "other";

export const ANY_EVENT = "*";

export const STATE_ARRAY_KEY = "$array";
export const STATE_INDEX_KEY = "$index";
export const STATE_ELEMENT_KEY = "$element";
export const STATE_ITERATION_KEY = "$iteration";

export const LLM_SCHEMA_FALLBACK_KEY = "$llm";

export const LLM_SUBCOMMAND_PARSE = "PARSE";
export const LLM_SUBCOMMAND_CLASSIFY = "CLASSIFY";
export const LLM_SUBCOMMAND_GENERATE = "GENERATE";
export const LLM_SUBCOMMAND_NORMALIZE = "NORMALIZE";
export const VARY_SHUFFLE_KEY = "SHUFFLE";
export const VARY_OMIT_KEY = "OMIT";
export const VARY_PICK_KEY = "PICK";

export const EVENT_KEY = "$event";
export const INPUT_KEY = "$input";
export const PARAMS_KEY = "$params";

export type EventHandlerOpts = { once: boolean };

export type StoryTemplate = {
  body: WellNode;
  defaults: Record<string, SerialValue>;
};

export type StoryEvaluatorFunc = (
  expr: string,
  vars: Record<string, SerialValue>,
  funcs: Record<string, ExprEvalFunc>,
) => SerialValue;

export type StoryOperatorFunc = (
  node: WellNode,
  ctx: StoryEventContext,
  params: Record<string, SerialValue>,
) => SerialValue[] | void;

export type StoryCartridge = Record<string, Buffer | string>;

export type DDVOptions = {
  mode?: "cycle" | "bag" | "random";
};

export type DDVState = {
  cycles: Record<string, number>;
  bags: Record<string, { order: number[]; idx: number }>;
};

export type MediaOptions = {
  duration: number;
  background: number;
  volume: number;
  loop: number;
};

export type StoryEvent = {
  id: string;
  created: number; // Unix time when instantiated
  processed: number; // Unix time when sent through engine step function (-1 for unprocessed)
  rendered: number; // Unix time when send to the client to render (-1 for unrendered)
  captured: number; // Unix time when captured by an ON handler (-1 for uncaptured)
  act: Act; // Intent classification - "command", "dialog", "narration", "query", "preference", "system"
  channel: Channel;
  type: StoryEventType | string;
  from: string; // Actor id (may be the player, an NPC id, or the engine itself)
  to: string[]; // Direct recipient ids
  obs: string[]; // Ids of those who see the event
  excl: string[]; // Ids of those who explicitly *cannot* see the event
  value: string; // Normalized semantic content; may be same as 'raw'
  raw: string; // The raw input as received from the client
  result: SerialValue; // Structured data from post-processing the value
  tags: string[]; // Arbitrary tags
  priority: number; // Priority score. 0 means discardable, 1 means keep at all costs; for heuristic truncation
  scene: string | null; // Scene id this event is associated with; can be used for arbitrary grouping
  ante: string | null; // ID of the preceding/causal event (for threading responses)
  voice: string | null; // Voice id for TTS engine (only if this is speech)
  url: string | null; // Attached audio/visual clip (sound effect, music, image)
  background: number; // 0 = foreground, 1 = background. Note: we may want to add "duck-others" and other enums
  duration: number; // How long this event lasts in seconds (for WAIT, timed media)
  loop: number; // Whether to loop this clip or not, and if so how many times
  volume: number; // Audio volume
};

export type RawInputShape = {
  from: string;
  raw: string;
} & Partial<Omit<StoryEvent, "from" | "raw">>;

export type Player = {
  id: string;
  label: string;
};

export type StorySession = {
  mode: "text" | "audio";
  player: Player;
  params: Record<string, SerialValue>;
  state: Record<string, SerialValue>;
  inputs: RawInputShape[];
  history: StoryEvent[];
  entities: Record<
    string,
    {
      modus: WellNode;
      persona: string;
      stats: Record<string, SerialValue>;
      lineage: string;
      npcId: number;
    }
  >;
  lineages: Record<
    string,
    {
      adam: Record<string, SerialValue>;
      eve: Record<string, SerialValue>;
      blend: Record<string, BlendStrategy>;
      depth: number;
      traits: Record<string, Record<string, SerialValue>>;
    }
  >;
  seed: string;
  cycle: number;
  time: number;
  turns: number;
  ddv: DDVState;
  once: Record<string, boolean>;
  stack: Record<string, SerialValue>[];
  checkpoints: Record<number, number[]>;
  handlers: Record<number, boolean>;
  options: {
    maxEventsPerStep: number;
    maxCallsPerEvent: number;
    maxTimePerStep: number;
  };
};

export type LLMCallOptions = {
  models: string[];
};

export type PlayType = "sound" | "music";
export type GetFunc = <T extends SerialValue>(path: string) => T;
export type SetFunc = <T extends SerialValue>(path: string, value: T, scoped?: boolean) => T;

export type LlmFunc = (
  instructions: LLMInstruction[],
  schema: JsonSchema,
  options?: LLMCallOptions,
) => Promise<unknown>;

export type SayFunc = (from: string, body: string, options?: Partial<StoryEvent>) => void;
export type PlayFunc = (type: PlayType, promptOrUrl: string, options?: Partial<MediaOptions>) => void;
export type EmitFunc = (partial: StrictPartialEvent) => StoryEvent;
export type SendFunc = (input: RawInputShape) => Promise<void>;

export type StoryDirectiveFunc = (
  node: WellNode,
  ctx: StoryEventContext,
  params: MarshalledParams,
  eaves: string[],
) => Promise<SerialValue[] | void>;

export type StoryDirectiveFuncDef = {
  type: string[];
  func: StoryDirectiveFunc;
};

export type StoryEventContext = {
  session: StorySession;
  rng: PRNG;
  io: IOFunc;
  sources: StorySources;
  blocks: Record<string, WellNode>;
  templates: Record<string, StoryTemplate>;
  evaluate: StoryEvaluatorFunc;
  get: GetFunc;
  set: SetFunc;
  event: StoryEvent;
  directives: StoryDirectiveFuncDef[];
  ops: Record<string, StoryOperatorFunc>;
  emit: EmitFunc;
  send: SendFunc;
  llm: LlmFunc;
  play: PlayFunc;
  say: SayFunc;
  break?: () => void;
  started: number;
  elapsed: number;
  calls: number;
  path: number[];
  resume: number[];
  halted: boolean;
  exited: boolean;
  handler: number;
};

export const HOST = "HOST";
export const PLAYER = "PLAYER";
export const ENGINE = "ENGINE";

export const inferDefaultsForType = (type: StoryEventType | string): Pick<StoryEvent, "act"> => {
  switch (type) {
    case StoryEventType.$message:
      return { act: "dialog" };
    case StoryEventType.$media:
      return { act: "media" };
    case StoryEventType.$entity:
      return { act: "info" };
    default:
      return { act: "system" };
  }
};

export type StrictPartialEvent = {
  type: StoryEvent["type"];
  from: StoryEvent["from"];
} & Partial<Omit<StoryEvent, "id" | "time" | "phase" | "type" | "from">>;

export const reifyEvent = (input: StrictPartialEvent, random: () => number): StoryEvent => {
  const { type, from, ...rest } = input;
  const inferred = inferDefaultsForType(type);
  return {
    id: ulid(random),
    created: Date.now(),
    processed: -1,
    rendered: -1,
    captured: -1,
    type,
    channel: "engine",
    from,
    to: [],
    obs: [],
    excl: [],
    value: "",
    tags: [],
    ante: null,
    raw: "",
    result: null,
    priority: 0,
    scene: null,
    voice: null,
    duration: 0,
    url: null,
    volume: 1,
    background: 0,
    loop: 0,
    ...inferred,
    ...rest,
  };
};

export function contextReadable(ctx: StoryEventContext) {
  // Flatten all stack scopes with later scopes taking precedence
  const stackVars: Record<string, SerialValue> = {};
  for (const scope of ctx.session.stack) {
    Object.assign(stackVars, scope);
  }

  const turn = ctx.session.turns;
  return {
    // Magic variables ($ prefix)
    $turns: turn,
    $first: turn === 0,
    $time: ctx.session.time,
    $event: ctx.event,
    [PARAMS_KEY]: ctx.session.params,
    // Author-defined state
    ...ctx.sources.meta,
    params: ctx.session.params,
    ...ctx.session.state,
    ...stackVars, // Stack variables override session state
  };
}

export const WELL_EXT = ".dram";

export function isMain(p: string) {
  return p.endsWith(`main.${WELL_EXT}`);
}

// Don't use ROOT here; ROOT is indended only for actual top-level nodes
export function wrapKids(kids: WellNode[], type: string = GROUP_TYPE) {
  return { type, args: "", kids, vars: [], eave: "" };
}

export const ROOT_TYPE = "ROOT";
export const GROUP_TYPE = "GROUP";
export const SET_TYPE = "SET";
export const VAR_TYPE = "VAR";
export const TEXTVAR_TYPE = "TEXT_ASSIGN";
export const SCENE_TYPE = "SCENE";
export const CODE_TYPE = "CODE";
export const TEXT_TYPE = "TEXT";
export const CAPTURE_TYPE = "CAPTURE";
export const SUSPEND_TYPE = "SUSPEND";
export const LLM_TYPE = "LLM";
export const IF_TYPE = "IF";
export const ELSE_TYPE = "ELSE";
export const ONCE_TYPE = "ONCE";
export const INPUT_TYPE = "INPUT";
export const MACRO_TYPE = "MACRO";
export const BLOCK_TYPE = "BLOCK";
export const TEMPLATE_TYPE = "TEMPLATE";
export const MUSIC_TYPE = "MUSIC";
export const SOUND_TYPE = "SOUND";
export const PARALLEL_TYPE = "PARALLEL";
export const FETCH_TYPE = "FETCH";
export const EACH_TYPE = "EACH";
export const MAP_TYPE = "MAP";
export const VARY_TYPE = "VARY";
export const DATA_TYPE = "DATA";
export const BREAK_TYPE = "BREAK";
export const CASE_TYPE = "CASE";
export const WHEN_TYPE = "WHEN";
export const LOG_TYPE = "LOG";
export const SCHEMA_TYPE = "SCHEMA";
export const PROMPT_USER_TYPE = "USER PROMPT";
export const PROMPT_SYSTEM_TYPE = "SYSTEM PROMPT";
export const BOOT_TYPE = "BOOT";
export const EMIT_TYPE = "EMIT";
export const EXIT_TYPE = "EXIT";
export const LOAD_TYPE = "LOAD";
export const SAVE_TYPE = "SAVE";
export const RENDER_TYPE = "RENDER";
export const WAIT_TYPE = "WAIT";
export const WHILE_TYPE = "WHILE";
export const RUN_TYPE = "RUN";
export const INCLUDE_TYPE = "INCLUDE";
export const ON_TYPE = "ON";
export const LOOP_TYPE = "LOOP";
export const DONE_TYPE = "DONE";
export const ENTITY_TYPE = "ENTITY";
export const LINEAGE_TYPE = "LINEAGE";
export const PRELUDE_TYPE = "PRELUDE";
export const RESUME_TYPE = "RESUME";
export const EPILOGUE_TYPE = "EPILOGUE";

export const EVENT_HANDLERS = [ON_TYPE, ONCE_TYPE, PRELUDE_TYPE, RESUME_TYPE, EPILOGUE_TYPE];

export const DIRECTIVE_TYPES = [
  ROOT_TYPE,
  GROUP_TYPE,
  TEXT_TYPE,
  SET_TYPE,
  VAR_TYPE,
  TEXTVAR_TYPE,
  SCENE_TYPE,
  CODE_TYPE,
  CAPTURE_TYPE,
  LLM_TYPE,
  IF_TYPE,
  ELSE_TYPE,
  ONCE_TYPE,
  INPUT_TYPE,
  BLOCK_TYPE,
  TEMPLATE_TYPE,
  MUSIC_TYPE,
  SOUND_TYPE,
  PARALLEL_TYPE,
  FETCH_TYPE,
  EACH_TYPE,
  MAP_TYPE,
  VARY_TYPE,
  DATA_TYPE,
  BREAK_TYPE,
  CASE_TYPE,
  WHEN_TYPE,
  LOG_TYPE,
  EMIT_TYPE,
  EXIT_TYPE,
  LOAD_TYPE,
  SAVE_TYPE,
  RENDER_TYPE,
  WAIT_TYPE,
  WHILE_TYPE,
  RUN_TYPE,
  INCLUDE_TYPE,
  ON_TYPE,
  LOOP_TYPE,
  DONE_TYPE,
  ENTITY_TYPE,
  LINEAGE_TYPE,
  PRELUDE_TYPE,
  RESUME_TYPE,
  EPILOGUE_TYPE,
  "DEFAULT",
  "INCR",
  "DECR",
  "TOGGLE",
  "PUSH",
  "POP",
  "SHIFT",
  "UNSHIFT",
  "SPLICE",
] as const;

export const VAR_DEFINING_TYPES = [
  SET_TYPE,
  VAR_TYPE,
  TEXTVAR_TYPE,
  "DEFAULT",
  "INCR",
  "DECR",
  CAPTURE_TYPE,
  DATA_TYPE,
  FETCH_TYPE,
  LLM_TYPE,
  CODE_TYPE,
  RENDER_TYPE,
];

export function reifySession(session: Partial<StorySession> = {}): StorySession {
  return {
    seed: "aramatoric",
    mode: "audio",
    player: {
      id: PLAYER,
      label: PLAYER,
    },
    inputs: [],
    params: {},
    state: {},
    history: [],
    entities: {},
    lineages: {},
    cycle: -1,
    time: -1,
    turns: 0,
    ddv: { cycles: {}, bags: {} },
    once: {},
    stack: [],
    checkpoints: {},
    handlers: {},
    options: {
      maxTimePerStep: 30_000,
      maxEventsPerStep: 1_000,
      maxCallsPerEvent: 1_000,
    },
    ...session,
  };
}

export function reifyStoryMeta(partial: Partial<StoryMeta> = {}): StoryMeta {
  return {
    voices: {},
    pronunciations: {},
    scripts: {},
    ...partial,
  };
}

export function reifyCartridge(inp: any): StoryCartridge {
  if (!inp) {
    return {};
  }
  if (typeof inp === "string") {
    return { "main.dram": inp };
  }
  if (Array.isArray(inp)) {
    return {};
  }
  if (typeof inp === "object") {
    return inp;
  }
  return {};
}

export function cleanSpokenText(text: string) {
  return text.replaceAll("(", "[").replaceAll(")", "]"); // For ElevenLabs voice instructions
}

export function findNodesByType(node: WellNode, type: string): WellNode[] {
  const results: WellNode[] = [];
  if (node.type === type) {
    results.push(node);
  }
  for (const child of node.kids || []) {
    results.push(...findNodesByType(child, type));
  }
  return results;
}

export function findNodeByArgs(node: WellNode, args: string): WellNode | null {
  if (node.args === args) {
    return node;
  }
  for (const child of node.kids || []) {
    const found = findNodeByArgs(child, args);
    if (found) return found;
  }
  return null;
}

export function singleLineEvent(event: StoryEvent) {
  return `[${event.type}:${event.act}:${event.id.slice(-3)}] ${event.from}${event.to.length > 0 ? ` (to ${event.to.join(",")})` : ""}: ${event.value}`;
}

const splitOpts = (s: string) => s.split(/(?<!\\)\|/g).map((x) => x.trim().replace(/\\([|\[\]])/g, "$1"));

const shuffle = (n: number, next: () => number) => {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function resolveBracketDDV(
  s: string,
  ctx: {
    rng: { next: () => number; randomElement: <T>(a: T[]) => T };
    session: { ddv: DDVState };
  },
): string {
  if (!s.includes("[[")) return s;
  return s.replace(/\[\[([\s\S]+?)\]\]/g, (_m, raw: string) => {
    let inner = raw.trim();
    let mode: DDVOptions["mode"] = "random";
    if (inner[0] === "^") {
      mode = "cycle";
      inner = inner.slice(1).trim();
    } else if (inner[0] === "~") {
      mode = "bag";
      inner = inner.slice(1).trim();
    }
    return pickDDV(splitOpts(inner), ctx.session.ddv, ctx.rng, { mode });
  });
}

export function pickDDV(
  vars: string[],
  ddv: DDVState,
  rng: { next: () => number; randomElement: <T>(a: T[]) => T },
  opts: DDVOptions,
): string {
  if (vars.length < 2) return vars[0] ?? "";
  const { mode = "random" } = opts;
  const key = vars.join("|");
  if (mode === "cycle") {
    const i = ddv.cycles[key] ?? 0;
    ddv.cycles[key] = (i + 1) % vars.length;
    return vars[i % vars.length];
  }
  if (mode === "bag") {
    let bag = ddv.bags[key];
    if (!bag || bag.order.length !== vars.length) {
      bag = { order: shuffle(vars.length, rng.next), idx: 0 };
      ddv.bags[key] = bag;
    }
    const pick = vars[bag.order[bag.idx]];
    bag.idx = (bag.idx + 1) % bag.order.length;
    if (bag.idx === 0) bag.order = shuffle(vars.length, rng.next);
    return pick;
  }
  return rng.randomElement(vars);
}

export function tokensToArgText(tokens: LexerToken[]) {
  return tokens
    .map((token) => {
      if (token.type === "QUO") {
        return JSON.stringify(token.value);
      }
      return token.value;
    })
    .join("")
    .trim();
}

export function arrayizeTokensOrNull(tokens: LexerToken[], delim: string = ","): SerialValue[] | null {
  const wows = trimTokenSpaces(tokens);
  if (wows.length < 2) return null;
  // Pre-flight check to avoid we aren't in just a math formula
  for (let i = 0; i < wows.length; i++) {
    const cand = wows[i];
    // I wonder if we should allow "." values too like "Dr. Smith"
    if (cand.type === "PCT" && cand.value !== delim) {
      return null;
    }
  }
  const first = wows[0];
  const last = wows[wows.length - 1];
  const isParen = first.type === "PCT" && first.value === "(" && last.type === "PCT" && last.value === ")";
  const isBracket = first.type === "PCT" && first.value === "[" && last.type === "PCT" && last.value === "]";
  if (!isParen && !isBracket) {
    return null;
  }
  const out: string[] = [];
  let accum: string = "";
  for (let i = 1; i < wows.length - 1; i++) {
    const inner = wows[i];
    if (inner.type === "PCT" && inner.value === delim) {
      out.push(accum);
      accum = "";
      continue;
    }
    accum += inner.value;
  }
  return out.map((inner) => {
    if (isBlank(inner)) return inner; // because empty string yields 0 when put into Number
    if (inner === "false") return false;
    if (inner === "true") return true;
    if (inner === "null" || inner === "undefined") return null;
    const non = parseNumberOrNull(inner);
    if (non !== null) return non;
    return inner;
  });
}

export function marshallTokensToValue(tokens: LexerToken[], evaluate: StoryEvaluatorFunc): SerialValue {
  const aon = arrayizeTokensOrNull(tokens);
  if (Array.isArray(aon)) {
    return aon;
  }
  const val = tokensToScalarValue(tokens);
  if (typeof val === "string") {
    if (isValidUrl(val)) {
      return val;
    }
    return evaluate(val, {}, {});
  }
  return val;
}

export function spanToArtifact(span: LexerToken[], evaluate: StoryEvaluatorFunc): SerialValue {
  if (span.length < 1) {
    return null;
  }
  if (span.every((token) => token.type === "SPC")) {
    return null;
  }
  if (span.length === 1) {
    const { value, type } = span[0];
    if (type === "NUM") {
      return Number(value);
    }
    if (type === "QUO") {
      return value;
    }
    if (type === "PCT" || type === "SPC") {
      return null;
    }
    if (isVarPath(value)) {
      const stateVal = evaluate(value, {}, {});
      if (stateVal !== null) return stateVal;
    }
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null" || value === "undefined") return null;
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== "") return num;
    return value;
  }
  return marshallTokensToValue(span, evaluate) ?? tokensToArgText(span);
}

export function onlyNonSpaceTokens(tokens: LexerToken[]): LexerToken[] {
  return tokens.filter((t) => t.type !== "SPC");
}

export function trimSpaceTokens(tokens: LexerToken[]): LexerToken[] {
  if (tokens.length < 1) return [];
  if (tokens[0].type === "SPC") return trimSpaceTokens(tokens.slice(1));
  if (tokens[tokens.length - 1].type === "SPC") return trimSpaceTokens(tokens.slice(-1));
  return tokens;
}

export function splitArgTokens(tokens: LexerToken[], delim: string = KVP_DELIM) {
  const groups: LexerToken[][] = [];
  let group: LexerToken[] = [];
  for (const token of tokens) {
    if (token.type === "PCT" && token.value === delim) {
      if (group.length > 0) {
        groups.push(group);
        group = [];
      }
      continue;
    }
    group.push(token);
  }
  if (group.length > 0) {
    groups.push(group);
  }
  return groups.map(trimSpaceTokens);
}

export type MarshalledParams = {
  // The raw text of node.args
  text: string;
  // The parsed tokens of node.args
  tokens: LexerToken[];
  // Splitting into clauses delimited by ; then resolving the value, whether state var name, script chunk, etc.
  artifacts: SerialValue[];
  // Delimiting each K/V pair by ; assuming the first contiguous WRD token is the key and the rest is a value
  pairs: Record<string, SerialValue>;
  // The same as pairs, except *omitting* the first ;-delimited clause, for cases where we assume the first value
  // is an object of some kind, these are used as restructuring and merged into the first object
  trailers: Record<string, SerialValue>;
  // Full strings between each ; delimmiter
  clauses: string[];
  // Like clauses, but spans of tokens
  groups: LexerToken[][];
  // Flat list of all keys derived assuming ;-delimited
  keys: string[];
};

/**
 * This extremely important method is the way that we parse a node's "args", i.e. the stuff between
 * a "DIRECTIVE" and its "DO" terminator. In practice nodes have different semantics but end up needing
 * many similar utilities and rather than spread this across each directive, we choose to handle it
 * here all in one place where we can do the work in an efficient way. If you make a change here,
 * make sure to run the unit test because it took a full day to figure out how to do this correctly.
 */
export function marshallParams(text: string, evaluate: StoryEvaluatorFunc): MarshalledParams {
  const tokens = tokenize(text);
  const groups = splitArgTokens(tokens);
  const pairs: Record<string, SerialValue> = {};
  const clauses: string[] = [];
  const keys: string[] = [];
  const trailers: Record<string, SerialValue> = {};
  const artifacts: SerialValue[] = [];
  for (let idx = 0; idx < groups.length; idx++) {
    const group = groups[idx];
    const wows = onlyNonSpaceTokens(group);
    const first = wows[0];
    if (!first) {
      clauses.push("");
      artifacts.push(null);
      continue;
    }
    if (wows.length === 1) {
      clauses.push(first.value);
      const artifact = spanToArtifact(wows, evaluate);
      artifacts.push(artifact);
      keys.push(first.value);
      if (artifact && !Array.isArray(artifact) && typeof artifact === "object") {
        Object.assign(pairs, artifact);
      } else {
        pairs[first.value] = null;
      }
      continue;
    }
    const clause = tokensToArgText(group);
    clauses.push(clause);
    const aon = arrayizeTokensOrNull(tokens);
    if (Array.isArray(aon)) {
      artifacts.push(aon);
    } else {
      if (looksLikeScriptExpression(group)) {
        const interp = evaluate(clause, {}, {});
        if (interp !== null) {
          artifacts.push(interp);
          continue;
        }
      }
    }
    keys.push(first.value);
    // Ensure we properly handle k/v pair-like sections
    const value = spanToArtifact(trimSpaceTokens(group.slice(1)), evaluate);
    pairs[first.value] = value;
    artifacts.push(value);
    if (idx > 0) {
      trailers[first.value] = value;
    }
  }
  return {
    text,
    tokens,
    clauses,
    artifacts,
    pairs,
    trailers,
    groups,
    keys,
  };
}

export function readNamedClause(params: MarshalledParams): string {
  const group = params.groups[0] ?? [];
  const plain = params.clauses[0]?.trim() ?? "";
  if (onlyNonSpaceTokens(group).length > 1) {
    return plain;
  }
  return castToString(params.artifacts[0] ?? plain);
}

export function replaceNodeAtPath(root: WellNode, path: number[], newArgs: string): WellNode {
  if (path.length === 0) {
    return { ...root, args: newArgs };
  }
  const [idx, ...rest] = path;
  return {
    ...root,
    kids: root.kids.map((kid, i) => (i === idx ? replaceNodeAtPath(kid, rest, newArgs) : kid)),
  };
}

export function collectVariablesUpTo(root: WellNode, target: number[], currentPath: number[] = []): string[] {
  const vars: string[] = [];
  function isBeforeTarget(path: number[]): boolean {
    for (let i = 0; i < Math.min(path.length, target.length); i++) {
      if (path[i] < target[i]) return true;
      if (path[i] > target[i]) return false;
    }
    return path.length < target.length;
  }
  function walk(node: WellNode, path: number[], parentEave: string) {
    if (!isBeforeTarget(path) && path.length >= target.length) return;
    if (parentEave) {
      parentEave.split(",").forEach((v) => {
        const trimmed = v.trim();
        if (trimmed && !vars.includes(trimmed)) vars.push(trimmed);
      });
    }
    node.vars.forEach((v) => {
      if (!vars.includes(v.name)) vars.push(v.name);
    });
    if (VAR_DEFINING_TYPES.includes(node.type) && node.args) {
      const match = node.args.match(/^(\w+)\s/);
      if (match && !vars.includes(match[1])) vars.push(match[1]);
    }
    node.kids.forEach((kid, i) => {
      walk(kid, [...path, i], node.eave);
    });
  }
  walk(root, currentPath, "");
  return vars;
}

export function buildNodeSchema(extras: string[]) {
  const allTypes = [...DIRECTIVE_TYPES, ...extras] as [string, ...string[]];
  const schema: z.ZodType<{
    type: string;
    args: string;
    kids: unknown[];
    vars: { name: string; type: "val" | "arr" }[];
    eave: string;
  }> = z.lazy(() =>
    z.object({
      type: z.enum(allTypes),
      args: z.string(),
      kids: z.array(schema),
      vars: z.array(WellVarBindingSchema),
      eave: z.string(),
    }),
  );
  return schema;
}

const LLM_BLOCK_OPEN = "<<";
const LLM_BLOCK_CLOSE = ">>";

export type LLMBlockParams = Record<string, SerialValue>;

export type EmbeddedSegment =
  | { kind: "text"; value: string }
  | { kind: "prompt"; value: string; params: LLMBlockParams };

const NOOP_EVAL: StoryEvaluatorFunc = () => null;

function parseLLMBlockParams(raw: string): { params: LLMBlockParams; body: string } {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("(")) return { params: {}, body: trimmed };
  const close = trimmed.indexOf(")");
  if (close < 0) return { params: {}, body: trimmed };
  const inner = trimmed.slice(1, close);
  const body = trimmed.slice(close + 1).trim();
  const { pairs } = marshallParams(inner, NOOP_EVAL);
  return { params: pairs, body };
}

export function extractEmbeddedSegments(text: string): EmbeddedSegment[] {
  const segs: EmbeddedSegment[] = [];
  let cursor = 0;
  let open = text.indexOf(LLM_BLOCK_OPEN, cursor);
  while (open >= 0) {
    const token = readTemplateToken(text, open, LLM_BLOCK_OPEN, LLM_BLOCK_CLOSE, false, false);
    if (!token) break;
    const before = text.slice(cursor, open).trim();
    if (before) segs.push({ kind: "text", value: before });
    const raw = token.body.trim();
    if (raw) {
      const { params, body } = parseLLMBlockParams(raw);
      if (body) segs.push({ kind: "prompt", value: body, params });
    }
    cursor = token.end;
    open = text.indexOf(LLM_BLOCK_OPEN, cursor);
  }
  const tail = text.slice(cursor).trim();
  if (tail) segs.push({ kind: "text", value: tail });
  return segs;
}

export function extractEmbeddedPrompt(text: string): { prompt: string; remainder: string } {
  const segs = extractEmbeddedSegments(text);
  const prompts = segs.filter((s) => s.kind === "prompt").map((s) => s.value);
  const texts = segs.filter((s) => s.kind === "text").map((s) => s.value);
  return { prompt: prompts.join("\n"), remainder: texts.join(" ").trim() };
}

export type IORequest =
  | { kind: "llm"; instructions: LLMInstruction[]; schema: JsonSchema; models: string[] }
  | { kind: "fetch"; url: string }
  | { kind: "save"; uid: string; session: StorySession }
  | { kind: "load"; uid: string }
  | { kind: "speech"; text: string; voice: StoryVoiceSpec }
  | { kind: "sound"; prompt: string; durationMs: number }
  | { kind: "music"; prompt: string; durationMs: number }
  | { kind: "image"; prompt: string }
  | { kind: "video"; prompt: string; durationMs: number; format: string; assets: string[] };

type IOResultMap = {
  llm: unknown | null;
  fetch: { status: number; data: string; contentType: string };
  save: void;
  load: StorySession | null;
  speech: { url: string };
  sound: { url: string };
  music: { url: string };
  image: { url: string };
  video: { url: string };
};

export type IOResult<K extends IORequest["kind"]> = IOResultMap[K];

export type IOFunc = <K extends IORequest["kind"]>(request: Extract<IORequest, { kind: K }>) => Promise<IOResult<K>>;

export type LLMYieldFunc = (expr: string) => Promise<SerialValue>;

export type Model = (typeof LLM_SLUGS)[number];

export type BaseGenerateOptions = {
  disableCache?: boolean;
  seed?: string;
};

export type GenerateTextCompletionOptions = BaseGenerateOptions & {
  models: NonEmpty<Model>;
  useWebSearch: boolean;
};
