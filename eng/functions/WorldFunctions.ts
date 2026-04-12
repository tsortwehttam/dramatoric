import { SerialValue } from "../../lib/CoreTypings";
import { castToString, isRecord, safeGet, toStringArray } from "../../lib/EvalCasting";
import { StoryEntityEntry, StoryEvent, StoryEventContext, StoryEventType, StorySession } from "../Helpers";
import { readEntityStatsFromEntries, removeEntityEntry, upsertEntityEntry } from "./EntityEntryHelpers";

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

type EntityProjectionOpts = {
  observer: string | null;
  includePrivate: boolean;
  includeSpace: boolean;
  includeRender: boolean;
  includeExtra: boolean;
};

type EntityLocation = {
  place: string;
  rel: string;
};

const RESERVED_WORLD_KEYS = new Set(["kind", "public", "private", "location", "space", "render"]);
const PATCHABLE_ROOT_KEYS = new Set(["kind", "public", "private", "location", "space", "render"]);
const POV_EVENT_TYPES = new Set<string>([StoryEventType.$message, StoryEventType.$entity]);
const MAX_LOCATION_DEPTH = 100;

/**
 * Returns a world-state entity snapshot by name.
 * @name entity
 * @param name Entity name.
 * @returns Entity snapshot with name and stats, or null if missing.
 * @example entity("ALICE") //=> {"name":"ALICE","kind":"person"}
 */
export function getEntitySnapshot(session: StorySession, name: SerialValue): SerialValue {
  const id = castToString(name);
  return projectEntitySnapshot(session, id, {
    observer: null,
    includePrivate: true,
    includeSpace: true,
    includeRender: true,
    includeExtra: true,
  });
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
    you: projectEntitySnapshot(session, observer, {
      observer,
      includePrivate: true,
      includeSpace: true,
      includeRender: false,
      includeExtra: true,
    }),
    people: [] as SerialValue[],
    things: [] as SerialValue[],
    places: [] as SerialValue[],
    events: [] as SerialValue[],
  };

  for (const target of visibleNames) {
    if (target === observer) {
      continue;
    }
    const value = projectEntitySnapshot(session, target, {
      observer,
      includePrivate: false,
      includeSpace: true,
      includeRender: false,
      includeExtra: true,
    });
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

export function doesEntityObserveEvent(session: StorySession, observer: SerialValue, event: StoryEvent): boolean {
  return isEventVisibleTo(session, castToString(observer), event);
}

export function setEntityEntries(
  ctx: StoryEventContext,
  name: string,
  entries: StoryEntityEntry[],
): Record<string, SerialValue> | null {
  const item = ctx.session.entities[name];
  if (!item) {
    return null;
  }

  const prev = cloneLocationValue(
    Object.prototype.hasOwnProperty.call(item.stats, "location") ? item.stats.location : null,
  );
  item.entries = entries;
  item.stats = readEntityStatsFromEntries(entries);
  syncEntityState(ctx, name, prev);
  return item.stats;
}

export function applyWorldPatches(ctx: StoryEventContext, name: SerialValue, patches: SerialValue): SerialValue {
  const id = castToString(name);
  const item = ctx.session.entities[id];
  if (!item || !Array.isArray(patches)) {
    return 0;
  }

  let count = 0;
  let entries = [...item.entries];
  for (let i = 0; i < patches.length; i += 1) {
    const patch = parseWorldPatch(patches[i]);
    if (!patch || !isPatchPathAllowed(patch.path)) {
      continue;
    }
    if (patch.op === "set") {
      entries = upsertEntityEntry(entries, patch.path, patch.value, ctx.rng.next);
      count += 1;
      continue;
    }

    if (entries.some((entry) => entry.path === patch.path)) {
      entries = removeEntityEntry(entries, patch.path);
      count += 1;
    }
  }

  setEntityEntries(ctx, id, entries);
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

export function projectEntitySnapshot(session: StorySession, target: string, opts: EntityProjectionOpts): SerialValue {
  const item = session.entities[target];
  if (!item) {
    return null;
  }

  const publicData = isRecord(item.stats.public) ? (item.stats.public as Record<string, SerialValue>) : {};
  const privateData = isRecord(item.stats.private) ? (item.stats.private as Record<string, SerialValue>) : {};
  const spaceData = isRecord(item.stats.space) ? { ...(item.stats.space as Record<string, SerialValue>) } : null;
  const renderData = isRecord(item.stats.render) ? { ...(item.stats.render as Record<string, SerialValue>) } : null;
  const base = {
    name: target,
    kind: castToString(item.stats.kind) || "person",
    public: { ...publicData },
    location: isRecord(item.stats.location) ? { ...(item.stats.location as Record<string, SerialValue>) } : null,
  } as Record<string, SerialValue>;

  if (opts.includePrivate && opts.observer === target) {
    base.private = { ...privateData };
  }
  if (opts.includeSpace && spaceData) {
    base.space = spaceData;
  }
  if (opts.includeRender && renderData) {
    base.render = renderData;
  }

  if (opts.includeExtra) {
    for (const key in item.stats) {
      if (RESERVED_WORLD_KEYS.has(key)) {
        continue;
      }
      base[key] = item.stats[key];
    }
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
