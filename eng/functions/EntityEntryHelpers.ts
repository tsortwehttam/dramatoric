import yaml from "js-yaml";
import { SerialValue } from "../../lib/CoreTypings";
import { castToString, isRecord, safeGet } from "../../lib/EvalCasting";
import { isBlank, ulid } from "../../lib/TextHelpers";
import { StoryEntityEntry, StorySession } from "../Helpers";
import { PROMPT_ENTRY_PATH, ParsedEntityEntry, buildEntityStats } from "../EntityParseHelpers";

export function createEntityEntries(
  parsed: ParsedEntityEntry[],
  random: () => number,
): StoryEntityEntry[] {
  return parsed.map((item) => ({
    id: ulid(random),
    path: item.path,
    value: item.value,
    public: item.public,
    mutable: item.mutable,
  }));
}

export function mergeEntityEntries(
  existing: StoryEntityEntry[],
  incoming: StoryEntityEntry[],
  replacePrompt: boolean,
): StoryEntityEntry[] {
  let next = [...existing];
  const hasPrompt = incoming.some((item) => item.path === PROMPT_ENTRY_PATH);
  if (replacePrompt && hasPrompt) {
    next = next.filter((item) => item.path !== PROMPT_ENTRY_PATH);
  }

  for (const item of incoming) {
    if (isAppendPath(item.path)) {
      next.push(item);
      continue;
    }
    const idx = next.findIndex((prev) => prev.path === item.path);
    if (idx < 0) {
      next.push(item);
      continue;
    }
    next[idx] = {
      ...item,
      id: next[idx]!.id,
    };
  }

  return next;
}

export function applyEntityEntryEdits(
  existing: StoryEntityEntry[],
  editsRaw: SerialValue,
): StoryEntityEntry[] {
  if (!Array.isArray(editsRaw)) {
    return existing;
  }

  const next = [...existing];
  for (const raw of editsRaw) {
    if (!isRecord(raw)) {
      continue;
    }
    const id = castToString(raw.id ?? "").trim();
    const op = castToString(raw.op ?? "").trim();
    if (!id || !op) {
      continue;
    }
    const idx = next.findIndex((item) => item.id === id && item.mutable);
    if (idx < 0) {
      continue;
    }
    if (op === "remove") {
      next.splice(idx, 1);
      continue;
    }
    if (op !== "replace") {
      continue;
    }
    next[idx] = {
      ...next[idx]!,
      value: (raw.value ?? null) as SerialValue,
    };
  }
  return next;
}

export function upsertEntityEntry(
  existing: StoryEntityEntry[],
  path: string,
  value: SerialValue,
  random: () => number,
): StoryEntityEntry[] {
  const next = [...existing];
  const idx = next.findIndex((item) => item.path === path);
  const pub = path === "kind" || path.startsWith("public.") || path.startsWith("location.") || path.startsWith("space.") || path.startsWith("render.");
  if (idx < 0) {
    next.push({
      id: ulid(random),
      path,
      value,
      public: pub,
      mutable: true,
    });
    return next;
  }

  next[idx] = {
    ...next[idx]!,
    value,
  };
  return next;
}

export function removeEntityEntry(
  existing: StoryEntityEntry[],
  path: string,
): StoryEntityEntry[] {
  return existing.filter((item) => item.path !== path);
}

export function readEntityStatsFromEntries(entries: StoryEntityEntry[]) {
  return buildEntityStats(entries.map(({ path, value, public: isPublic, mutable }) => ({ path, value, public: isPublic, mutable })));
}

export function buildPromptEntityDoc(
  session: StorySession,
  target: string,
  observer: string,
): Record<string, SerialValue> | null {
  const item = session.entities[target];
  if (!item) {
    return null;
  }
  const entries = item.entries
    .filter((entry) => observer === target || entry.public || entry.path.startsWith("location.") || entry.path.startsWith("space.") || entry.path.startsWith("render.") || entry.path === "kind")
    .map((entry) => {
      const value = readEntryValue(item.stats, entry);
      if (value === undefined) {
        return null;
      }
      return {
        id: entry.id,
        path: entry.path,
        mutable: entry.mutable,
        value,
      };
    })
    .filter(Boolean) as { id: string; path: string; mutable: boolean; value: SerialValue }[];

  return {
    name: target,
    kind: castToString(item.stats.kind) || "person",
    entries,
  };
}

export function renderEntityPromptBlock(
  session: StorySession,
  actor: string,
  pov: SerialValue,
): string {
  const record = isRecord(pov) ? (pov as Record<string, SerialValue>) : {};
  const people = readNamedDocs(session, record.people, actor);
  const things = readNamedDocs(session, record.things, actor);
  const places = readNamedDocs(session, record.places, actor);
  const events = Array.isArray(record.events)
    ? record.events.map((item) => eventToPromptFrag(item)).filter((item) => !isBlank(item))
    : [];

  const doc = {
    you: buildPromptEntityDoc(session, actor, actor),
    people,
    things,
    places,
    events,
  };
  return yaml.dump(doc, { lineWidth: -1, noRefs: true }).trim();
}

export function readMutableEntryIds(entries: StoryEntityEntry[]) {
  return entries.filter((item) => item.mutable).map((item) => `${item.id} (${item.path})`);
}

function isAppendPath(path: string) {
  return path.endsWith("[]");
}

function readEntryValue(stats: Record<string, SerialValue>, entry: StoryEntityEntry): SerialValue | undefined {
  if (entry.path === PROMPT_ENTRY_PATH) {
    return entry.value;
  }
  if (entry.path.endsWith("[]")) {
    return entry.value;
  }
  return safeGet(stats, entry.path) ?? entry.value;
}

function readNamedDocs(session: StorySession, value: SerialValue, observer: string) {
  if (!Array.isArray(value)) {
    return {};
  }
  const out: Record<string, Record<string, SerialValue>> = {};
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const name = castToString(item.name ?? "").trim();
    if (!name) {
      continue;
    }
    const doc = buildPromptEntityDoc(session, name, observer);
    if (!doc) {
      continue;
    }
    out[name] = doc;
  }
  return out;
}

function eventToPromptFrag(value: SerialValue) {
  if (!isRecord(value)) {
    return "";
  }
  const event = value as Record<string, SerialValue>;
  const from = castToString(event.from ?? "").trim();
  const body = castToString(event.value ?? "").trim();
  if (!from && !body) {
    return "";
  }
  return `${from}: ${body}`.trim();
}
