import { SerialValue } from "../../lib/CoreTypings";
import { castToString, isRecord, safeGet, safeSet, toStringArray } from "../../lib/EvalCasting";
import { StoryEvent, StoryEventContext, StoryEventType, StorySession } from "../Helpers";

export type WorldPatch = {
  op: "set" | "del";
  path: string;
  value: SerialValue;
};

export type WorldAction = {
  type: string;
  to: string[];
  body: string;
};

type EntityLocation = {
  place: string;
  rel: string;
};

const RESERVED_WORLD_KEYS = new Set(["kind", "public", "private", "location"]);
const PATCHABLE_ROOT_KEYS = new Set(["kind", "public", "private", "location"]);
const POV_EVENT_TYPES = new Set<string>([StoryEventType.$message, StoryEventType.$entity]);
const MAX_LOCATION_DEPTH = 100;

/**
 * Returns a world-state entity snapshot by name.
 * @name entity
 * @param name Entity name.
 * @returns Entity snapshot with name, persona, and stats, or null if missing.
 * @example entity("ALICE") //=> {"name":"ALICE","persona":"...","kind":"person"}
 */
export function getEntitySnapshot(session: StorySession, name: SerialValue): SerialValue {
  const id = castToString(name);
  const item = session.entities[id];
  if (!item) {
    return null;
  }

  return {
    name: id,
    persona: item.persona,
    ...item.stats,
  };
}

/**
 * Returns the entity's current location object.
 * @name loc
 * @param name Entity name.
 * @returns Location object, or null if the entity has no location.
 * @example loc("ALICE") //=> {"place":"JURY ROOM","rel":"in"}
 */
export function getEntityLocation(session: StorySession, name: SerialValue): SerialValue {
  const id = castToString(name);
  const item = session.entities[id];
  if (!item) {
    return null;
  }

  const value = item.stats.location;
  return isRecord(value) ? (value as SerialValue) : null;
}

/**
 * Returns true if two entities share a location chain overlap.
 * @name coLocated
 * @param a First entity.
 * @param b Second entity.
 * @returns True if the entities overlap in world location.
 * @example coLocated("ALICE", "BOB") //=> true
 */
export function areEntitiesCoLocated(session: StorySession, a: SerialValue, b: SerialValue): boolean {
  const left = getLocationChain(session, castToString(a));
  const right = getLocationChain(session, castToString(b));
  if (!left.length || !right.length) {
    return false;
  }

  return left.some((name) => right.includes(name));
}

/**
 * Returns true if the observer can see the target from world state alone.
 * @name visibleTo
 * @param observer Observer entity.
 * @param target Target entity.
 * @returns True if target is visible to observer.
 * @example visibleTo("ALICE", "BOB") //=> true
 */
export function isEntityVisibleTo(session: StorySession, observer: SerialValue, target: SerialValue): boolean {
  const a = castToString(observer);
  const b = castToString(target);
  if (!session.entities[a] || !session.entities[b]) {
    return false;
  }
  if (a === b) {
    return true;
  }
  return areEntitiesCoLocated(session, a, b);
}

/**
 * Returns a subjective visible world projection for the observer.
 * @name pov
 * @param name Observer entity.
 * @returns Subjective POV object with visible entities and events.
 * @example pov("ALICE") //=> {"you":{...},"people":[...],"things":[...],"places":[...],"events":[...]}
 */
export function getEntityPov(session: StorySession, name: SerialValue): SerialValue {
  const observer = castToString(name);
  const item = session.entities[observer];
  if (!item) {
    return null;
  }

  const visibleNames = Object.keys(session.entities).filter((target) => isEntityVisibleTo(session, observer, target));
  const out = {
    you: buildPovEntity(session, observer, observer),
    people: [] as SerialValue[],
    things: [] as SerialValue[],
    places: [] as SerialValue[],
    events: [] as SerialValue[],
  };

  for (const target of visibleNames) {
    if (target === observer) {
      continue;
    }
    const value = buildPovEntity(session, observer, target);
    const kind = castToString(safeGet((value ?? {}) as Record<string, SerialValue>, "kind")).toLowerCase();
    if (kind === "place") {
      out.places.push(value);
      continue;
    }
    if (kind === "thing") {
      out.things.push(value);
      continue;
    }
    out.people.push(value);
  }

  out.events = session.history.filter((event) => isEventVisibleTo(session, observer, event)).map(simplifyPovEvent);
  return out;
}

export function mergeEntityStats(
  existing: Record<string, SerialValue>,
  incoming: Record<string, SerialValue>,
): Record<string, SerialValue> {
  const next = { ...existing };

  for (const key in incoming) {
    const value = incoming[key];
    if (!RESERVED_WORLD_KEYS.has(key)) {
      next[key] = value;
      continue;
    }

    if ((key === "public" || key === "private") && isRecord(value) && isRecord(next[key])) {
      next[key] = {
        ...(next[key] as Record<string, SerialValue>),
        ...(value as Record<string, SerialValue>),
      };
      continue;
    }

    if (key === "location" && isRecord(value) && isRecord(next[key])) {
      next[key] = {
        ...(next[key] as Record<string, SerialValue>),
        ...(value as Record<string, SerialValue>),
      };
      continue;
    }

    next[key] = value;
  }

  return next;
}

export function applyWorldPatches(ctx: StoryEventContext, name: SerialValue, patches: SerialValue): SerialValue {
  const id = castToString(name);
  const item = ctx.session.entities[id];
  if (!item || !Array.isArray(patches)) {
    return 0;
  }

  const prev = cloneLocationValue(
    Object.prototype.hasOwnProperty.call(item.stats, "location") ? item.stats.location : null,
  );
  let count = 0;
  for (let i = 0; i < patches.length; i += 1) {
    const patch = parseWorldPatch(patches[i]);
    if (!patch || !isPatchPathAllowed(patch.path)) {
      continue;
    }
    if (patch.op === "set") {
      safeSet(item.stats as Record<string, SerialValue>, patch.path, patch.value);
      count += 1;
      continue;
    }

    if (deletePath(item.stats, patch.path)) {
      count += 1;
    }
  }

  syncEntityState(ctx, id, prev);
  return count;
}

export function emitWorldActions(ctx: StoryEventContext, actor: SerialValue, actions: SerialValue): SerialValue {
  const from = castToString(actor);
  if (!ctx.session.entities[from] || !Array.isArray(actions)) {
    return 0;
  }

  let count = 0;
  for (let i = 0; i < actions.length; i += 1) {
    const action = parseWorldAction(actions[i]);
    if (!action) {
      continue;
    }

    if (action.type === "say") {
      ctx.say(from, action.body, {
        to: action.to,
        result: action,
      });
      count += 1;
      continue;
    }

    ctx.emit({
      type: action.type,
      from,
      to: action.to,
      value: action.body,
      result: action,
    });
    count += 1;
  }

  return count;
}

export function syncEntityState(ctx: StoryEventContext, name: string, prevValue?: SerialValue) {
  const item = ctx.session.entities[name];
  if (!item) {
    return;
  }

  const prev = readLocationShape(prevValue);
  const next = readLocationShape(item.stats.location);
  const result = {
    ...item.stats,
    persona: item.persona,
  } as SerialValue;

  ctx.set(name, result);
  ctx.emit({
    type: StoryEventType.$entity,
    from: name,
    channel: "engine",
    result,
  });

  if (prevValue !== undefined) {
    emitLocationTransitions(ctx, name, prev, next);
  }
}

function buildPovEntity(session: StorySession, observer: string, target: string): SerialValue {
  const item = session.entities[target];
  if (!item) {
    return null;
  }

  const publicData = isRecord(item.stats.public) ? (item.stats.public as Record<string, SerialValue>) : {};
  const privateData = isRecord(item.stats.private) ? (item.stats.private as Record<string, SerialValue>) : {};
  const base = {
    name: target,
    kind: castToString(item.stats.kind) || "person",
    persona: item.persona,
    public: { ...publicData },
    location: isRecord(item.stats.location) ? { ...(item.stats.location as Record<string, SerialValue>) } : null,
  } as Record<string, SerialValue>;

  if (observer === target) {
    base.private = { ...privateData };
  }

  for (const key in item.stats) {
    if (RESERVED_WORLD_KEYS.has(key)) {
      continue;
    }
    base[key] = item.stats[key];
  }

  return base;
}

function getLocationChain(session: StorySession, name: string): string[] {
  if (!session.entities[name]) {
    return [];
  }

  const seen = new Set<string>([name]);
  const out: string[] = [name];
  let next = getPlaceName(session, name);
  let depth = 0;

  while (next && depth < MAX_LOCATION_DEPTH && !seen.has(next)) {
    out.push(next);
    seen.add(next);
    next = getPlaceName(session, next);
    depth += 1;
  }

  return out;
}

function getPlaceName(session: StorySession, name: string): string | null {
  const value = getEntityLocation(session, name);
  if (!isRecord(value)) {
    return null;
  }
  const place = value.place;
  return typeof place === "string" && place ? place : null;
}

function isEventVisibleTo(session: StorySession, observer: string, event: StoryEvent): boolean {
  if (!POV_EVENT_TYPES.has(event.type)) {
    return false;
  }
  if (event.excl.includes(observer)) {
    return false;
  }
  if (event.obs.length > 0) {
    return event.obs.includes(observer);
  }
  if (event.to.length > 0) {
    return event.to.includes(observer) || event.from === observer;
  }
  if (event.type === StoryEventType.$entity) {
    return isEntityVisibleTo(session, observer, event.from);
  }
  return event.from === observer || isEntityVisibleTo(session, observer, event.from);
}

function simplifyPovEvent(event: StoryEvent): SerialValue {
  return {
    type: event.type,
    from: event.from,
    to: event.to,
    origin: event.origin,
    destination: event.destination,
    value: event.value,
    result: event.result,
  };
}

function parseWorldPatch(value: SerialValue): WorldPatch | null {
  if (!isRecord(value)) {
    return null;
  }

  const op = value.op;
  const path = value.path;
  if ((op !== "set" && op !== "del") || typeof path !== "string" || !path) {
    return null;
  }

  return {
    op,
    path,
    value: (value.value ?? null) as SerialValue,
  };
}

function parseWorldAction(value: SerialValue): WorldAction | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = value.type;
  if (typeof type !== "string" || !type) {
    return null;
  }

  return {
    type,
    to: toStringArray(value.to),
    body: typeof value.body === "string" ? value.body : "",
  };
}

function isPatchPathAllowed(path: string): boolean {
  const [root] = path.split(".");
  return Boolean(root) && PATCHABLE_ROOT_KEYS.has(root);
}

function emitLocationTransitions(
  ctx: StoryEventContext,
  entity: string,
  prev: EntityLocation | null,
  next: EntityLocation | null,
) {
  if (isSamePlace(prev, next)) {
    return;
  }

  if (prev?.place && prev.place !== next?.place) {
    emitTransition(ctx, "location.exit", entity, prev, next);
  }

  if (next?.place && prev?.place !== next.place) {
    emitTransition(ctx, "location.enter", entity, prev, next);
  }

  emitTransition(ctx, "location.move", entity, prev, next);
}

function emitTransition(
  ctx: StoryEventContext,
  type: string,
  entity: string,
  prev: EntityLocation | null,
  next: EntityLocation | null,
) {
  ctx.emit({
    type,
    from: entity,
    to: next?.place ? [next.place] : [],
    channel: "engine",
    origin: prev?.place ?? null,
    destination: next?.place ?? null,
    result: {
      entity,
      rel: next?.rel ?? prev?.rel ?? null,
      originRel: prev?.rel ?? null,
      destinationRel: next?.rel ?? null,
    },
  });
}

function readLocationShape(value: SerialValue | undefined): EntityLocation | null {
  if (!isRecord(value)) {
    return null;
  }

  const place = typeof value.place === "string" ? value.place : "";
  const rel = typeof value.rel === "string" ? value.rel : "";
  if (!place && !rel) {
    return null;
  }

  return {
    place,
    rel,
  };
}

function isSamePlace(a: EntityLocation | null, b: EntityLocation | null): boolean {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.place === b.place;
}

function cloneLocationValue(value: SerialValue): SerialValue {
  if (!isRecord(value)) {
    return value;
  }

  return { ...value };
}

function deletePath(stats: Record<string, SerialValue>, path: string): boolean {
  const parts = path.split(".");
  if (!parts.length) {
    return false;
  }

  let current: Record<string, SerialValue> = stats;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i]!;
    const next = current[part];
    if (!isRecord(next)) {
      return false;
    }
    current = next as Record<string, SerialValue>;
  }

  const last = parts[parts.length - 1]!;
  if (!Object.prototype.hasOwnProperty.call(current, last)) {
    return false;
  }
  delete current[last];
  return true;
}
