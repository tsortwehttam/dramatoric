import { SerialValue } from "../../lib/CoreTypings";
import { castToString, isRecord, safeGet } from "../../lib/EvalCasting";
import { StoryEventContext, StorySession } from "../Helpers";
import { ExprEvalFunc } from "../Evaluator";
import {
  applyWorldPatches,
  doesEntityObserveEvent,
  areEntitiesCoLocated,
  emitWorldActions,
  getEntityLocation,
  getEntityPov,
  getEntitySnapshot,
  isEntityVisibleTo,
  setEntityEntries,
} from "./WorldFunctions";
import { upsertEntityEntry } from "./EntityEntryHelpers";

export function buildWorldExprFunctions(getCtx: () => StoryEventContext): Record<string, ExprEvalFunc> {
  const stat: ExprEvalFunc = (id: SerialValue, key: SerialValue): SerialValue => {
    const session = getCtx().session;
    const eid = castToString(id);
    const ekey = castToString(key);
    if (session.entities[eid]) {
      return safeGet(session.entities[eid].stats as Record<string, SerialValue>, ekey) ?? 0;
    }
    return 0;
  };

  const setStat: ExprEvalFunc = (id: SerialValue, key: SerialValue, value: SerialValue): SerialValue => {
    const session = getCtx().session;
    const eid = castToString(id);
    const ekey = castToString(key);
    if (session.entities[eid]) {
      const next = upsertEntityEntry(session.entities[eid].entries, ekey, value, getCtx().rng.next);
      setEntityEntries(getCtx(), eid, next);
      return value;
    }
    return 0;
  };

  const hasEntity: ExprEvalFunc = (id: SerialValue): SerialValue => {
    return !!getCtx().session.entities[castToString(id)];
  };

  const include: ExprEvalFunc = () => null;

  return {
    stat,
    setStat,
    hasEntity,
    entity: (id) => getEntitySnapshot(getCtx().session, id),
    loc: (id) => getEntityLocation(getCtx().session, id),
    coLocated: (a, b) => areEntitiesCoLocated(getCtx().session, a, b),
    visibleTo: (observer, target) => isEntityVisibleTo(getCtx().session, observer, target),
    doesObserveEvent: (observer, event) =>
      isRecord(event) ? doesEntityObserveEvent(getCtx().session, observer, event as any) : false,
    pov: (id) => getEntityPov(getCtx().session, id),
    applyPatches: (id, patches) => applyWorldPatches(getCtx(), id, patches),
    emitActions: (actor, actions) => emitWorldActions(getCtx(), actor, actions),
    include,
  };
}

export function buildCompileWorldExprFunctions(): Record<string, ExprEvalFunc> {
  const session = { entities: {} } as StorySession;
  return {
    stat: () => 0,
    setStat: (_id, _key, value) => value,
    hasEntity: () => false,
    entity: (id) => getEntitySnapshot(session, id),
    loc: (id) => getEntityLocation(session, id),
    coLocated: () => false,
    visibleTo: () => false,
    doesObserveEvent: () => false,
    pov: (id) => getEntityPov(session, id),
    applyPatches: () => 0,
    emitActions: () => 0,
    include: () => "",
  };
}
