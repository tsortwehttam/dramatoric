import { JsonSchema, SerialValue } from "../lib/CoreTypings";
import { castToString, safeGet, safeSet } from "../lib/EvalCasting";
import { walkTree } from "../lib/GenericNodeHelpers";
import { LLMInstruction } from "../lib/LLMTypes";
import { createPRNG } from "../lib/RandHelpers";
import { isUrlValue } from "../lib/TextHelpers";
import { sortBy, summarizeObj } from "../lib/ValueHelpers";
import { DIRECTIVES } from "./Directives";
import { OPS } from "./directives/DefaultOperators";
import { createLoadedRunner, ExprEvalFunc } from "./Evaluator";
import { executeNode, rawInputsToFullyReifiedMessages } from "./Execution";
import {
  BLOCK_TYPE,
  contextReadable,
  ENGINE,
  EVENT_HANDLERS,
  EVENT_KEY,
  GetFunc,
  INPUT_KEY,
  IOFunc,
  LLMCallOptions,
  LlmFunc,
  marshallParams,
  MediaOptions,
  PlayFunc,
  PlayType,
  RawInputShape,
  reifyEvent,
  SayFunc,
  SendFunc,
  SET_TYPE,
  SetFunc,
  singleLineEvent,
  StoryEvaluatorFunc,
  StoryEvent,
  StoryEventContext,
  StoryEventType,
  StorySession,
  StorySources,
  StrictPartialEvent,
  WellNode,
  WellVarBinding,
  wrapKids,
} from "./Helpers";
import { tokenize, tokensToKVP } from "./Lexer";

export type ContextCallbacks = {
  onEvent: (event: StoryEvent) => void;
  onError: (error: Error) => void;
};

export function createContext(io: IOFunc, session: StorySession, sources: StorySources, callbacks: ContextCallbacks) {
  const rng = createPRNG(session.seed, session.cycle);

  const get: GetFunc = <T extends SerialValue>(path: string) => {
    // Check scope stack before trying global state
    const pathStr = castToString(path);
    for (let i = session.stack.length - 1; i >= 0; i--) {
      const scope = session.stack[i];
      if (scope && pathStr in scope) {
        return scope[pathStr] as T;
      }
    }
    return safeGet(session.state, pathStr) as T;
  };

  const set: SetFunc = <T extends SerialValue>(path: string, value: T, scoped?: boolean) => {
    const pathStr = castToString(path);
    if (scoped && session.stack.length > 0) {
      const top = session.stack[session.stack.length - 1];
      safeSet(top as any, pathStr, value);
    } else {
      safeSet(session.state as any, pathStr, value);
    }
    return value;
  };

  const llm: LlmFunc = async (
    instructions: LLMInstruction[],
    schema: JsonSchema,
    options: LLMCallOptions = { models: [] },
  ) => {
    const value = await io({
      kind: "llm",
      instructions,
      schema,
      models: options.models,
    });
    console.info("[llm] ==>", value);
    return value;
  };

  const say: SayFunc = async (from: string, body: string, opts: Partial<StoryEvent> = {}) => {
    emit({
      type: StoryEventType.$message,
      channel: "output",
      from,
      raw: body,
      value: body,
      ...opts,
    });
  };

  const play: PlayFunc = async (type: PlayType, promptOrUrl: string, opts: Partial<MediaOptions> = {}) => {
    if (isUrlValue(promptOrUrl)) {
      emit({
        from: ENGINE,
        type: StoryEventType.$media,
        channel: "output",
        url: promptOrUrl,
        ...opts,
      });
    } else {
      emit({
        type: StoryEventType.$media,
        channel: "output",
        from: ENGINE,
        value: promptOrUrl,
      });
    }
  };

  function emit(partial: StrictPartialEvent): StoryEvent {
    const event = reifyEvent({ channel: "emit", ...partial }, rng.next);
    console.info("[event] emitted", event.type, event.value);
    if (event.type === StoryEventType.$exit) {
      ctx.exited = true;
    }
    // Emitted events automatically end up in the history
    if (!session.history.find((e) => e.id === event.id)) {
      session.history.push(event);
    }
    callbacks.onEvent(event);
    return event;
  }

  const send: SendFunc = async (input: RawInputShape) => {
    session.inputs.push(input);
    await step(ctx);
  };

  const stat: ExprEvalFunc = (id: SerialValue, key: SerialValue): SerialValue => {
    const eid = castToString(id);
    const ekey = castToString(key);
    if (session.entities[eid]) {
      return session.entities[eid].stats[ekey] ?? 0;
    }
    return 0;
  };

  const setStat: ExprEvalFunc = (id: SerialValue, key: SerialValue, value: SerialValue): SerialValue => {
    const eid = castToString(id);
    const ekey = castToString(key);
    if (session.entities[eid]) {
      session.entities[eid].stats[ekey] = value;
      emit({
        type: StoryEventType.$entity,
        from: eid,
        channel: "engine",
        result: { [ekey]: value },
      });
      return value;
    }
    return 0;
  };

  const hasEntity: ExprEvalFunc = (id: SerialValue): SerialValue => {
    return !!session.entities[castToString(id)];
  };

  const functions: Record<string, ExprEvalFunc> = {
    get: (key) => get(castToString(key)),
    set: (key, value) => set(castToString(key), value),
    stat,
    setStat,
    hasEntity,
  };

  const runner = createLoadedRunner(rng, {}, functions);

  const evaluate: StoryEvaluatorFunc = (expr, vars, funcs) => {
    const allVars = { ...contextReadable(ctx), ...vars };
    const allFuncs = { ...functions, ...funcs };
    return runner.evaluate(expr, allVars, allFuncs);
  };

  const ctx: StoryEventContext = {
    // This empty event lets callers hit event.* w/o null checks
    event: reifyEvent({ type: StoryEventType.$none, from: ENGINE }, rng.next),
    session,
    io,
    rng,
    blocks: {},
    sources,
    directives: DIRECTIVES,
    ops: OPS,
    evaluate,
    get,
    set,
    llm,
    say,
    play,
    emit,
    send,
    started: Date.now(),
    elapsed: 0,
    calls: 0,
    path: [],
    resume: [],
    halted: false,
    exited: false,
    handler: -1,
  };

  // Put defaults global state so all are pre-declared for script eval
  if (session.turns < 1) {
    walkTree(sources.root, (node) => {
      if (node.type === SET_TYPE) {
        const kvp = tokensToKVP(tokenize(node.args));
        for (const key in kvp) {
          if (session.state[key] === undefined) {
            session.state[key] = null;
          }
        }
      }
      node.vars.forEach((v: WellVarBinding) => {
        if (session.state[v.name] === undefined) {
          session.state[v.name] = v.type === "arr" ? [] : null;
        }
      });
    });
  }

  // Assume all blocks are global by definition
  walkTree(sources.root, (node) => {
    if (node.type === BLOCK_TYPE) {
      const pms = marshallParams(node.args, ctx.evaluate);
      const name = castToString(pms.artifacts[0] ?? pms.text);
      ctx.blocks[name] = wrapKids(node.kids);
    }
  });

  return ctx;
}

export async function handleEvent(top: WellNode, event: StoryEvent, ctx: StoryEventContext) {
  console.info("[engine] event", singleLineEvent(event));
  ctx.calls = 0; // Reset for max calls checker
  ctx.event = event;
  ctx.set(EVENT_KEY, event); // Allow {{$event.from}}, etc.
  ctx.set(event.type, event); // Allow {{someEvent.value}}, etc
  if (event.channel === "input") {
    ctx.set(INPUT_KEY, event); // Allow IF $input, {{$input.raw}}, etc.
  }
  await executeNode(top, ctx);
  event.processed = Date.now();
}

export async function step(ctx: StoryEventContext) {
  // Emit $start on first step of a fresh session
  if (ctx.session.turns === 0) {
    const startEvent = reifyEvent({ type: StoryEventType.$start, from: ENGINE, channel: "engine" }, ctx.rng.next);
    ctx.session.history.push(startEvent);
  }

  const inputs = await rawInputsToFullyReifiedMessages(ctx.session.inputs.splice(0), ctx, true);
  ctx.session.history.push(...inputs);
  const events = sortBy(
    ctx.session.history.filter((event) => event.processed < 0),
    "created",
  );

  console.info("[engine] step", {
    turns: ctx.session.turns,
    time: ctx.session.time,
    player: ctx.session.player,
    mode: ctx.session.mode,
    state: summarizeObj(ctx.session.state),
    inputs: ctx.session.inputs,
  });

  const handlers: { node: WellNode; idx: number }[] = [];
  ctx.sources.root.kids.forEach((node, idx) => {
    if (EVENT_HANDLERS.includes(node.type)) {
      handlers.push({ node, idx });
    }
  });

  const queued = new Set<string>();
  events.forEach((e) => queued.add(e.id));

  while (events.length > 0) {
    const next = events.shift();
    if (!next) break;
    queued.delete(next.id);
    for (const { node, idx } of handlers) {
      ctx.handler = idx;
      ctx.halted = false;
      ctx.exited = false;
      await handleEvent(wrapKids([node]), next, ctx);
    }
    const more = ctx.session.history.filter((e) => e.processed < 0 && !queued.has(e.id));
    more.forEach((e) => queued.add(e.id));
    events.push(...more);
  }

  // Important: RNG and execution logic depends on these:
  ctx.session.turns += 1;
  ctx.session.cycle = ctx.rng.getCycle();
}
