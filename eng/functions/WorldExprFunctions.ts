import { SerialValue } from "../../lib/CoreTypings";
import { castToString, safeGet, safeSet } from "../../lib/EvalCasting";
import { StoryEventContext, StorySession } from "../Helpers";
import { ExprEvalFunc } from "../Evaluator";
import {
  applyWorldPatches,
  areEntitiesCoLocated,
  emitWorldActions,
  getEntityLocation,
  getEntityPov,
  getEntitySnapshot,
  isEntityVisibleTo,
  updateEntityStats,
} from "./WorldFunctions";

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
      const next = { ...session.entities[eid].stats } as Record<string, SerialValue>;
      safeSet(next, ekey, value);
      updateEntityStats(getCtx(), eid, next);
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
    pov: (id) => getEntityPov(session, id),
    applyPatches: () => 0,
    emitActions: () => 0,
    include: () => "",
  };
}
