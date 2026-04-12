import { JsonSchema, SerialValue } from "../../lib/CoreTypings";
import { castToString, isRecord, toStringArray } from "../../lib/EvalCasting";
import { jsonStableStringify } from "../../lib/JSONAndYAMLHelpers";
import { executeKids, gatherPromptAndSchemaForLLM, normalizeModelList, readBody, renderHandlebarsAndDDV, splitCaseKids } from "../Execution";
import { StoryEntityEntry } from "../Helpers";
import { buildCuePromptInstructions } from "../functions/CuePromptUtils";
import { parseEntityRecordSpec } from "../EntityParseHelpers";
import { applyEntityEntryEdits, createEntityEntries, mergeEntityEntries } from "../functions/EntityEntryHelpers";
import { doesEntityObserveEvent, getEntityPov, setEntityEntries } from "../functions/WorldFunctions";
import {
  ACT_TYPE,
  cloneNode,
  CURRENT_ACTOR_KEY,
  CUE_TYPE,
  ELSE_TYPE,
  EVENT_KEY,
  StoryEvent,
  StoryEventType,
  IF_TYPE,
  INTERPRET_TYPE,
  PROMPT_SYSTEM_TYPE,
  PROMPT_USER_TYPE,
  REACT_TYPE,
  SAY_TYPE,
  SIMULATE_TYPE,
  STATE_ITERATION_KEY,
  STATE_TYPE,
  StoryDirectiveFuncDef,
  StoryEventContext,
  TEXT_TYPE,
  WellNode,
  WHEN_TYPE,
  WITH_TYPE,
} from "../Helpers";

const CUE_ALLOWED_CHILD_TYPES = new Set([STATE_TYPE, PROMPT_SYSTEM_TYPE, PROMPT_USER_TYPE, TEXT_TYPE, IF_TYPE]);

const CueResultSchema: JsonSchema = {
  type: "object",
  properties: {
    edits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          op: {
            type: "string",
            enum: ["replace", "remove"],
          },
          value: {},
        },
        required: ["id", "op"],
        additionalProperties: false,
      },
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          to: {
            type: "array",
            items: { type: "string" },
          },
          body: { type: "string" },
        },
        required: ["type", "to", "body"],
        additionalProperties: false,
      },
    },
  },
  required: ["edits", "actions"],
  additionalProperties: false,
};

const ReactionMatchesSchema: JsonSchema = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["matches"],
  additionalProperties: false,
};

export const SIMULATE_directive: StoryDirectiveFuncDef = {
  type: [SIMULATE_TYPE],
  func: async (node, ctx, pms) => {
    ctx.session.stack.push({});
    ctx.set(STATE_ITERATION_KEY, 0, true);
    const prevBreak = ctx.break;
    let shouldBreak = false;
    ctx.break = () => {
      shouldBreak = true;
    };

    let i = 0;
    for (;;) {
      const args = renderHandlebarsAndDDV(node.args, ctx).trim();
      if (ctx.exited || ctx.halted) {
        break;
      }
      if (isTruthy(ctx, readSimulateUntil(args))) {
        break;
      }
      if (hasReachedMax(ctx, readSimulateMax(args), i)) {
        break;
      }

      shouldBreak = false;
      ctx.set(STATE_ITERATION_KEY, i, true);
      await executeKids(node.kids, ctx);
      if (ctx.halted || ctx.exited || shouldBreak) {
        break;
      }
      i += 1;
    }

    ctx.break = prevBreak;
    ctx.session.stack.pop();
  },
};

export const CUE_directive: StoryDirectiveFuncDef = {
  type: [CUE_TYPE],
  func: async (node, ctx, pms) => {
    const actor = resolveDeclaredActor(ctx, pms);
    if (!actor) {
      console.warn("CUE requires an actor");
      return [];
    }

    const entity = ctx.session.entities[actor];
    if (!entity) {
      console.warn(`CUE missing entity "${actor}"`);
      return [];
    }

    ctx.session.stack.push({ [CURRENT_ACTOR_KEY]: actor });
    warnOnInvalidCueKids(node);
    await executeCueStateKids(node, ctx);

    const instructions = await gatherCuePrompt(node, ctx);
    const models = normalizeModelList(pms.pairs?.models);
    const result = await ctx.llm(
      buildCuePromptInstructions(actor, ctx, CueResultSchema, instructions),
      CueResultSchema,
      { models },
    );
    applyCueResult(ctx, actor, result);
    ctx.session.stack.pop();
    return [result as SerialValue];
  },
};

export const WITH_directive: StoryDirectiveFuncDef = {
  type: [WITH_TYPE],
  func: async (node, ctx, pms) => {
    const actor = resolveDeclaredActor(ctx, pms);
    if (!actor) {
      console.warn("WITH requires an actor or current cue");
      return [];
    }

    ctx.session.stack.push({ [CURRENT_ACTOR_KEY]: actor });
    await executeKids(node.kids, ctx);
    ctx.session.stack.pop();
    return [actor];
  },
};

export const REACT_directive: StoryDirectiveFuncDef = {
  type: [REACT_TYPE],
  func: async (node, ctx, pms) => {
    const actors = castToString(pms.text ?? "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);
    const event = ctx.get(EVENT_KEY) as StoryEvent | null;
    if (!event || !isReactableEvent(event)) {
      return [];
    }

    const out: SerialValue[] = [];
    const whenNodes = node.kids.filter((kid) => kid.type === WHEN_TYPE);
    const elseNode = node.kids.find((kid) => kid.type === ELSE_TYPE) ?? null;
    for (const actor of actors) {
      if (!ctx.session.entities[actor] || !doesEntityObserveEvent(ctx.session, actor, event) || event.from === actor) {
        continue;
      }

      ctx.session.stack.push({ [CURRENT_ACTOR_KEY]: actor });
      if (whenNodes.length < 1) {
        await executeKids(node.kids, ctx);
        out.push(actor);
        ctx.session.stack.pop();
        continue;
      }

      const matches = await selectReactionMatches(actor, event, whenNodes, ctx, pms.pairs?.models);
      if (matches.length < 1 && elseNode) {
        await executeKids(elseNode.kids, ctx);
      } else {
        for (const whenNode of whenNodes) {
          if (matches.includes(whenNode.args.trim())) {
            await executeKids(whenNode.kids, ctx);
          }
        }
      }
      out.push(...matches);
      ctx.session.stack.pop();
    }
    return out;
  },
};

export const INTERPRET_directive: StoryDirectiveFuncDef = {
  type: [INTERPRET_TYPE],
  func: async (node, ctx, pms) => {
    const { whenNodes, elseKids } = splitCaseKids(node.kids);
    if (whenNodes.length < 1) {
      return [];
    }

    const input = renderInterpretValue(ctx.evaluate(renderHandlebarsAndDDV(node.args, ctx), {}, {}));
    const choices = whenNodes.map((kid) => kid.args.trim()).filter(Boolean);
    const fallback = elseKids.length > 0 ? "__ELSE__" : "__NONE__";
    const actor = resolveScopedActor(ctx);
    const models = normalizeModelList(pms.pairs?.models);
    const result = await ctx.llm(
      [
        {
          role: "system",
          content: [
            actor ? `Choose the best interpretation for ${actor}'s reaction.` : "Choose the best interpretation for the input.",
            "Return exactly one interpretation string from the provided list.",
            "Do not explain your choice.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            "Input:",
            input,
            "Interpretations:",
            ...choices.map((choice) => `- ${choice}`),
            `- ${fallback} (use this if none of the above fit)`,
          ].join("\n"),
        },
      ],
      {},
      { models },
    );
    const selected = castToString(result).trim();
    if (selected === "__NONE__") {
      return [selected];
    }
    if (selected === fallback) {
      await executeKids(elseKids, ctx);
      return [selected];
    }
    const match = whenNodes.find((kid) => kid.args.trim() === selected);
    await executeKids(match ? match.kids : elseKids, ctx);
    return [selected];
  },
};

export const STATE_directive: StoryDirectiveFuncDef = {
  type: [STATE_TYPE],
  func: async (node, ctx, pms) => {
    const actor = resolveDeclaredActor(ctx, pms);
    if (!actor) {
      console.warn("STATE requires an actor or current cue");
      return [];
    }

    const entity = ctx.session.entities[actor];
    if (!entity) {
      console.warn(`STATE missing entity "${actor}"`);
      return [];
    }

    const body = (await readBody(node, ctx)).trim();
    const parsed = parseEntityRecordSpec(body);
    const entries = createEntityEntries(parsed.entries, ctx.rng.next);
    const extra: StoryEntityEntry[] = [];

    for (const key in pms.trailers) {
      extra.push({
        id: `${ctx.event.id}:${key}`,
        path: key,
        value: pms.trailers[key],
        public: false,
        mutable: false,
      });
    }

    entity.entries = mergeEntityEntries(entity.entries, [...entries, ...extra], false);
    return [setEntityEntries(ctx, actor, entity.entries) ?? entity.stats];
  },
};

export const SAY_directive: StoryDirectiveFuncDef = {
  type: [SAY_TYPE],
  func: async (node, ctx, pms) => {
    const actor = resolveScopedActor(ctx, pms);
    if (!actor) {
      console.warn("SAY requires an actor or current cue");
      return [];
    }

    const to = toStringArray(pms.trailers.to);
    const body = (await readBody(node, ctx)).trim();
    ctx.say(actor, body, {
      to,
      result: {
        type: "say",
        to,
        body,
      },
    });
    return [body];
  },
};

export const ACT_directive: StoryDirectiveFuncDef = {
  type: [ACT_TYPE],
  func: async (node, ctx, pms) => {
    const actor = resolveScopedActor(ctx, pms);
    if (!actor) {
      console.warn("ACT requires an actor or current cue");
      return [];
    }

    const type = castToString(pms.artifacts[0] ?? "");
    if (!type) {
      console.warn("ACT requires an action type");
      return [];
    }

    const to = toStringArray(pms.trailers.to);
    const body = (await readBody(node, ctx)).trim();
    const event = ctx.emit({
      type,
      from: actor,
      to,
      value: body,
      result: {
        type,
        to,
        body,
      },
    });
    return [event];
  },
};

function resolveDeclaredActor(ctx: StoryEventContext, pms: { text?: string; trailers?: Record<string, SerialValue> }) {
  const from = castToString(pms.trailers?.from ?? "").trim();
  if (from) {
    return from;
  }
  const text = castToString(pms.text ?? "").trim();
  if (text) {
    return text;
  }
  return resolveScopedActor(ctx);
}

function resolveScopedActor(ctx: StoryEventContext, pms?: { trailers?: Record<string, SerialValue> }) {
  const from = castToString(pms?.trailers?.from ?? "").trim();
  if (from) {
    return from;
  }
  return castToString(ctx.get<string>(CURRENT_ACTOR_KEY) ?? "").trim();
}

function isTruthy(ctx: StoryEventContext, value: unknown): boolean {
  if (value == null) {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const text = castToString(value).trim();
  if (!text) {
    return false;
  }
  return Boolean(ctx.evaluate(text, {}, {}));
}

function isReactableEvent(event: StoryEvent) {
  if (event.type === StoryEventType.$message) {
    return true;
  }
  if (event.type === StoryEventType.$entity) {
    return false;
  }
  return !event.type.startsWith("$");
}

async function selectReactionMatches(
  actor: string,
  event: StoryEvent,
  whenNodes: WellNode[],
  ctx: StoryEventContext,
  modelsRaw: SerialValue,
) {
  const choices = whenNodes.map((kid) => kid.args.trim()).filter(Boolean);
  if (choices.length < 1) {
    return [];
  }
  const models = normalizeModelList(modelsRaw);
  const result = await ctx.llm(
    [
      {
        role: "system",
        content: [
          `You are selecting which authored reaction descriptions match an observed event for ${actor}.`,
          "Return zero or more exact descriptions from the provided list.",
          "Only choose descriptions that are clearly supported by the event and current story context.",
          "Do not explain your choices.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Observer: ${actor}`,
          "Event:",
          renderReactionEvent(event),
          "",
          "Context:",
          JSON.stringify(getEntityPov(ctx.session, actor)),
          "",
          "Reaction descriptions:",
          ...choices.map((choice) => `- ${choice}`),
        ].join("\n"),
      },
    ],
    ReactionMatchesSchema,
    { models },
  );
  if (!isRecord(result) || !Array.isArray(result.matches)) {
    return [];
  }
  return result.matches.map(castToString).filter((match) => choices.includes(match));
}

function renderReactionEvent(event: StoryEvent) {
  return [
    `type: ${event.type}`,
    `from: ${event.from}`,
    `to: ${event.to.join(", ") || "(none)"}`,
    `value: ${event.value || "(none)"}`,
    `origin: ${event.origin ?? "(none)"}`,
    `destination: ${event.destination ?? "(none)"}`,
  ].join("\n");
}

function renderInterpretValue(value: SerialValue) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value == null) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return jsonStableStringify(value) ?? JSON.stringify(value, null, 2);
}

function hasReachedMax(ctx: StoryEventContext, value: unknown, iteration: number): boolean {
  if (value == null) {
    return false;
  }
  const maxValue = typeof value === "string" ? ctx.evaluate(value, {}, {}) : value;
  const max = Number(maxValue);
  return Number.isFinite(max) && iteration >= max;
}

function readSimulateUntil(text: string): string | null {
  return readSimulateArg(text, "until");
}

function readSimulateMax(text: string): string | null {
  return readSimulateArg(text, "max");
}

function readSimulateArg(text: string, key: string): string | null {
  const match = text.match(new RegExp(`(?:^|;)\\s*${key}\\s+(.+?)(?=\\s*;|$)`));
  return match?.[1]?.trim() ?? null;
}

async function executeCueStateKids(node: WellNode, ctx: StoryEventContext) {
  for (let i = 0; i < node.kids.length; i += 1) {
    const kid = node.kids[i];
    if (kid.type !== STATE_TYPE) {
      continue;
    }
    await executeKids([kid], ctx);
  }
}

async function gatherCuePrompt(node: WellNode, ctx: StoryEventContext) {
  const instructions = await gatherCuePromptKids(node.kids, ctx);
  return instructions;
}

async function gatherCuePromptKids(kids: WellNode[], ctx: StoryEventContext) {
  const promptNode = cloneNode(nodeFromKids(kids));
  promptNode.kids = [];
  const instructions = (await gatherPromptAndSchemaForLLM(promptNode, ctx, true)).instructions;

  for (let i = 0; i < kids.length; i += 1) {
    const kid = kids[i];
    if (kid.type === STATE_TYPE) {
      continue;
    }
    if (kid.type === TEXT_TYPE || kid.type === PROMPT_SYSTEM_TYPE || kid.type === PROMPT_USER_TYPE) {
      promptNode.kids = [kid];
      const result = await gatherPromptAndSchemaForLLM(promptNode, ctx, true);
      instructions.push(...result.instructions);
      continue;
    }
    if (kid.type === IF_TYPE && shouldIncludeCueIf(kid, ctx)) {
      instructions.push(...(await gatherCuePromptKids(kid.kids, ctx)));
    }
  }

  return instructions;
}

function shouldIncludeCueIf(node: WellNode, ctx: StoryEventContext) {
  const text = renderHandlebarsAndDDV(node.args, ctx).trim();
  if (!text) {
    return false;
  }
  return Boolean(ctx.evaluate(text, {}, {}));
}

function nodeFromKids(kids: WellNode[]): WellNode {
  return {
    type: "GROUP",
    args: "",
    kids,
    vars: [],
    eave: "",
  };
}

function warnOnInvalidCueKids(node: WellNode) {
  for (let i = 0; i < node.kids.length; i += 1) {
    const kid = node.kids[i];
    if (!CUE_ALLOWED_CHILD_TYPES.has(kid.type)) {
      console.warn(`CUE ignores child type "${kid.type}"`);
    }
  }
}

function applyCueResult(ctx: StoryEventContext, actor: string, value: unknown) {
  const entity = ctx.session.entities[actor];
  if (!entity || !isRecord(value)) {
    return;
  }

  entity.entries = applyEntityEntryEdits(entity.entries, (value.edits ?? []) as SerialValue);
  setEntityEntries(ctx, actor, entity.entries);

  const actions = Array.isArray(value.actions) ? value.actions : [];
  for (let i = 0; i < actions.length; i += 1) {
    const action = actions[i];
    if (!isRecord(action)) {
      continue;
    }
    const type = castToString(action.type ?? "").trim();
    const body = castToString(action.body ?? "").trim();
    if (!type || !body) {
      continue;
    }
    const to = toStringArray(action.to ?? []);
    if (type === "say") {
      ctx.say(actor, body, {
        to,
        result: {
          type,
          to,
          body,
        },
      });
      continue;
    }
    ctx.emit({
      type,
      from: actor,
      to,
      value: body,
      result: {
        type,
        to,
        body,
      },
    });
  }
}
