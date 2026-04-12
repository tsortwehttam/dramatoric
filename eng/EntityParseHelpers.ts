import { SerialValue } from "../lib/CoreTypings";
import { safeSet } from "../lib/EvalCasting";
import { safeJsonOrYamlParse } from "../lib/JSONAndYAMLHelpers";
import { isBlank } from "../lib/TextHelpers";

export type ParsedEntityField = {
  key: string;
  public: boolean;
  mutable: boolean;
  root: boolean;
  value: SerialValue;
};

export type ParsedEntityText = {
  value: string;
  public: boolean;
  mutable: boolean;
};

type ParsedEntityItem = ParsedEntityField | ParsedEntityText | { data: SerialValue };

export type ParsedEntityEntry = {
  path: string;
  value: SerialValue;
  public: boolean;
  mutable: boolean;
};

type ParsedEntitySpec = {
  entries: ParsedEntityEntry[];
  stats: Record<string, SerialValue>;
};

const ROOT_KEYS = new Set(["kind"]);
const LOCATION_KEYS = new Set(["place", "rel"]);
const SPACE_KEYS = new Set(["pos", "angle", "size", "shape", "points", "scale", "boundary"]);
const RENDER_KEYS = new Set([
  "skybox",
  "floor",
  "ceiling",
  "walls",
  "light",
  "sprite",
  "texture",
  "textures",
  "variants",
  "portrait",
]);

export const PROMPT_ENTRY_PATH = "prompt[]";
export const FACTS_KEY = "facts";

export function parseLooseEntityItems(body: string): ParsedEntityItem[] {
  const lines = body.split("\n");
  const out: ParsedEntityItem[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const bullet = line.match(/^\s*-\s+(.+)$/);
    if (bullet) {
      out.push({
        value: `- ${bullet[1]!.trim()}`,
        public: false,
        mutable: false,
      });
      continue;
    }

    if (((trimmed.startsWith("{") && !trimmed.startsWith("{{")) && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      out.push({ data: safeJsonOrYamlParse(trimmed) });
      continue;
    }

    const pair = line.match(/^\s*([@~!]+)?([A-Za-z_][A-Za-z0-9_.-]*):\s*(.*)$/);
    if (pair) {
      const marks = readMarks(pair[1] ?? "");
      const key = pair[2]!.trim();
      const rest = pair[3] ?? "";
      if (rest.trim() === "|") {
        const block: string[] = [];
        while (i + 1 < lines.length) {
          const next = lines[i + 1] ?? "";
          if (!/^\s+/.test(next)) {
            break;
          }
          block.push(next);
          i += 1;
        }
        out.push({
          key,
          public: marks.public,
          mutable: marks.mutable,
          root: marks.root,
          value: readIndentedBlock(block),
        });
        continue;
      }

      out.push({
        key,
        public: marks.public,
        mutable: marks.mutable,
        root: marks.root,
        value: safeJsonOrYamlParse(rest.trim()),
      });
      continue;
    }

    const marked = line.match(/^\s*([@~!]+)\s*(.+)$/);
    if (!marked) {
      out.push({
        value: trimmed,
        public: false,
        mutable: false,
      });
      continue;
    }

    const marks = readMarks(marked[1] ?? "");
    out.push({
      value: marked[2]!.trim(),
      public: marks.public,
      mutable: marks.mutable,
    });
  }

  return out;
}

export function parseEntityBody(body: string): ParsedEntitySpec {
  if (isBlank(body)) {
    return { entries: [], stats: {} };
  }
  return buildEntitySpec(parseLooseEntityItems(body));
}

export function parseEntityRecordBody(body: string): SerialValue {
  const trimmed = body.trim();
  if (!trimmed) {
    return {};
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return safeJsonOrYamlParse(body);
  }
  return buildEntitySpec(parseLooseEntityItems(body)).stats;
}

export function parseEntityRecordSpec(body: string): { entries: ParsedEntityEntry[]; stats: Record<string, SerialValue> } {
  const trimmed = body.trim();
  if (!trimmed) {
    return { entries: [], stats: {} };
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const data = safeJsonOrYamlParse(body);
    if (!isRecord(data)) {
      return { entries: [], stats: {} };
    }
    const entries = Object.keys(data).map((key) => ({
      path: key,
      value: data[key],
      public: false,
      mutable: false,
    }));
    return { entries, stats: data };
  }
  return buildEntitySpec(parseLooseEntityItems(body));
}

export function buildEntityStats(entries: ParsedEntityEntry[]): Record<string, SerialValue> {
  const stats: Record<string, SerialValue> = {};
  for (const entry of entries) {
    if (entry.path === PROMPT_ENTRY_PATH) {
      continue;
    }
    if (entry.path.endsWith("[]")) {
      const key = entry.path.slice(0, -2);
      const next = Array.isArray(readPath(stats, key)) ? ([...(readPath(stats, key) as SerialValue[]), entry.value] as SerialValue[]) : [entry.value];
      safeSet(stats, key, next);
      continue;
    }
    safeSet(stats, entry.path, entry.value);
  }
  return stats;
}

function buildEntitySpec(items: ParsedEntityItem[]): ParsedEntitySpec {
  const entries: ParsedEntityEntry[] = [];

  for (const item of items) {
    if ("data" in item) {
      if (isRecord(item.data)) {
        for (const key in item.data) {
          entries.push({
            path: readFieldPath(key, false, false),
            value: item.data[key],
            public: false,
            mutable: false,
          });
        }
      }
      continue;
    }

    if ("key" in item) {
      entries.push({
        path: readFieldPath(item.key, item.public, item.root),
        value: item.value,
        public: item.public,
        mutable: item.mutable,
      });
      continue;
    }

    entries.push({
      path: item.public || item.mutable ? `${item.public ? "public" : "private"}.${FACTS_KEY}[]` : PROMPT_ENTRY_PATH,
      value: item.value,
      public: item.public,
      mutable: item.mutable,
    });
  }

  return {
    entries,
    stats: buildEntityStats(entries),
  };
}

function readFieldPath(key: string, isPublic: boolean, isRoot: boolean): string {
  if (ROOT_KEYS.has(key)) {
    return key;
  }
  if (LOCATION_KEYS.has(key)) {
    return `location.${key}`;
  }
  if (SPACE_KEYS.has(key)) {
    return `space.${key}`;
  }
  if (RENDER_KEYS.has(key)) {
    return `render.${key}`;
  }
  if (isRoot) {
    return key;
  }
  return `${isPublic ? "public" : "private"}.${key}`;
}

function readMarks(raw: string) {
  return {
    public: raw.includes("@"),
    mutable: raw.includes("~"),
    root: raw.includes("!"),
  };
}

function readIndentedBlock(lines: string[]): string {
  const vals = lines
    .filter((line) => !isBlank(line))
    .map((line) => line.match(/^(\s*)/)?.[1].length ?? 0);
  const pad = vals.length > 0 ? Math.min(...vals) : 0;
  return lines
    .map((line) => line.slice(Math.min(pad, line.length)).replace(/\s+$/, ""))
    .join("\n")
    .trim();
}

function isRecord(value: SerialValue): value is Record<string, SerialValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPath(source: Record<string, SerialValue>, path: string): SerialValue | undefined {
  const parts = path.split(".");
  let cur: SerialValue = source;
  for (const part of parts) {
    if (!isRecord(cur) || !Object.prototype.hasOwnProperty.call(cur, part)) {
      return undefined;
    }
    cur = (cur as Record<string, SerialValue>)[part];
  }
  return cur;
}
