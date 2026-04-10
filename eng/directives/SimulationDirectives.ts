import { JsonSchema, SerialValue } from "../../lib/CoreTypings";
import { castToString, isRecord, toStringArray } from "../../lib/EvalCasting";
import { executeKids, gatherPromptAndSchemaForLLM, normalizeModelList, readBody, renderHandlebarsAndDDV } from "../Execution";
import { buildCuePromptInstructions } from "../functions/CuePromptUtils";
import { parseEntityRecordBody } from "./EntityDirective";
import { mergeEntityStats, syncEntityState } from "../functions/WorldFunctions";
import {
  ACT_TYPE,
  cloneNode,
  CURRENT_ACTOR_KEY,
  CUE_TYPE,
  IF_TYPE,
  PROMPT_SYSTEM_TYPE,
  PROMPT_USER_TYPE,
  SAY_TYPE,
  SIMULATE_TYPE,
  STATE_ITERATION_KEY,
  STATE_TYPE,
  StoryDirectiveFuncDef,
  StoryEventContext,
  TEXT_TYPE,
  WellNode,
  WITH_TYPE,
} from "../Helpers";

const CUE_ALLOWED_CHILD_TYPES = new Set([STATE_TYPE, PROMPT_SYSTEM_TYPE, PROMPT_USER_TYPE, TEXT_TYPE, IF_TYPE]);

const CueResultSchema: JsonSchema = {
  type: "object",
  properties: {
    state: {
      type: "object",
      additionalProperties: true,
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
  required: ["state", "actions"],
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
    const parsed = parseEntityRecordBody(body);
    const stats =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? ({ ...(parsed as Record<string, SerialValue>) } as Record<string, SerialValue>)
        : {};

    for (const key in pms.trailers) {
      stats[key] = pms.trailers[key];
    }

    const prev =
      Object.prototype.hasOwnProperty.call(entity.stats, "location") && entity.stats.location && typeof entity.stats.location === "object"
        ? { ...(entity.stats.location as Record<string, SerialValue>) }
        : entity.stats.location;
    entity.stats = mergeEntityStats(entity.stats, stats);
    syncEntityState(ctx, actor, prev);
    return [entity.stats];
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

  const nextState = isRecord(value.state) ? (value.state as Record<string, SerialValue>) : null;
  if (nextState) {
    const prev =
      Object.prototype.hasOwnProperty.call(entity.stats, "location") && entity.stats.location && typeof entity.stats.location === "object"
        ? { ...(entity.stats.location as Record<string, SerialValue>) }
        : entity.stats.location;
    entity.stats = mergeEntityStats(entity.stats, nextState);
    syncEntityState(ctx, actor, prev);
  }

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
