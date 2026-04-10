import { SerialValue } from "../../lib/CoreTypings";
import { safeJsonOrYamlParse } from "../../lib/JSONAndYAMLHelpers";
import { isBlank } from "../../lib/TextHelpers";
import { readBody } from "../Execution";
import { mergeEntityStats, syncEntityState } from "../functions/WorldFunctions";
import { ENTITY_TYPE, readNamedClause, StoryDirectiveFuncDef, StoryEventContext } from "../Helpers";

/**
 * ## ENTITY
 *
 * **Summary**
 * Declare or update a named entity with stats and a persona.
 * The body is parsed in multiple passes: first as structured data (JSON/YAML),
 * then as raw persona text. Redeclaring the same entity merges stats and replaces
 * the persona.
 *
 * **Syntax**
 * ```dramatoric
 * ENTITY: RATZ DO
 *   You are Ratz, a grizzled bartender with a Russian accent.
 * END
 * ```
 *
 * ```dramatoric
 * ENTITY: RATZ DO
 *   name: Ratz
 *   health: 100
 *   mood: calm
 *   persona: You are Ratz, a grizzled bartender with a Russian accent.
 * END
 * ```
 *
 * ```dramatoric
 * ENTITY: RATZ; health 100; mood "calm" DO
 *   You are Ratz, a grizzled bartender.
 *   << Respond in a gruff, world-weary tone. >>
 * END
 * ```
 *
 * ```dramatoric
 * ENTITY: ALICE DO
 *   kind: person
 *   public:
 *     mood: guarded
 *   private:
 *     goal: get home
 *   location:
 *     place: JURY ROOM
 *     rel: in
 *   persona: You are Alice, a skeptical juror.
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * ENTITY: GUARD DO
 *   health: 50
 *   persona: You are a stern palace guard.
 * END
 *
 * GUARD:
 * Halt! Who goes there?
 *
 * // Later, update the entity stats
 * ENTITY: GUARD; health 30 DO
 *   You are a wounded palace guard, struggling to stay on your feet.
 * END
 * ```
 *
 * **Notes**
 * - If the body parses as structured data with a `persona` field, that field
 *   becomes the entity's persona and remaining fields become stats.
 * - If the body does not parse as structured data, it is treated as raw persona text.
 * - Inline parameters (after semicolons) are merged into stats.
 * - Redeclaring the same entity merges new stats and replaces the persona.
 * - Reserved world-state keys `public`, `private`, and `location` merge shallowly.
 * - Changing `location.place` on an existing entity emits `location.move`
 *   plus derived `location.exit` and `location.enter` events.
 * - When a speaker name matches a registered entity, the entity's persona is
 *   automatically injected into dialogue generation.
 * - Access entity stats with `stat("ENTITY_NAME", "statKey")`.
 */
export const ENTITY_directive: StoryDirectiveFuncDef = {
  type: [ENTITY_TYPE],
  func: async (node, ctx, pms) => {
    const name = pms.clauses[0]?.trim() ?? readNamedClause(pms);
    if (!name) {
      return;
    }

    const body = await readBody(node, ctx);
    const { stats, persona } = parseEntityBody(body);

    // Merge inline params (after first key) as stats
    for (const key in pms.trailers) {
      stats[key] = pms.trailers[key];
    }

    const existing = ctx.session.entities[name];
    const prev = existing
      ? cloneLocationValue(Object.prototype.hasOwnProperty.call(existing.stats, "location") ? existing.stats.location : null)
      : undefined;
    if (existing) {
      existing.stats = mergeEntityStats(existing.stats, stats);
      existing.modus = node;
      if (persona) {
        existing.persona = persona;
      }
    } else {
      ctx.session.entities[name] = {
        modus: node,
        persona,
        stats,
      };
    }

    syncEntityState(ctx, name, prev);
    return [ctx.session.entities[name].stats];
  },
};

const PERSONA_KEYS = new Set(["persona", "modus", "description", "character", "bio"]);
const NESTED_SECTION_KEYS = new Set(["public", "private", "location"]);

function parseEntityBody(body: string): {
  stats: Record<string, SerialValue>;
  persona: string;
} {
  if (isBlank(body)) {
    return { stats: {}, persona: "" };
  }

  const parsed = parseEntityRecordBody(body);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, SerialValue>;
    const stats: Record<string, SerialValue> = {};
    let persona = "";
    for (const key in record) {
      if (PERSONA_KEYS.has(key.toLowerCase())) {
        persona = String(record[key] ?? "");
      } else {
        stats[key] = record[key];
      }
    }
    if (persona || Object.keys(stats).length > 0) {
      return { stats, persona };
    }
  }

  // Pass 2: Raw persona text
  return { stats: {}, persona: body };
}

export function parseEntityRecordBody(body: string): SerialValue {
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return safeJsonOrYamlParse(body);
  }

  const parsed = parseFlatStructuredLines(body);
  if (parsed) {
    return parsed;
  }

  return safeJsonOrYamlParse(body);
}

function parseFlatStructuredLines(body: string): Record<string, SerialValue> | null {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return null;
  }

  const out: Record<string, SerialValue> = {};
  let section: string | null = null;
  let sawStructured = false;

  for (const line of lines) {
    const header = line.match(/^([^:]+):\s*$/);
    if (header) {
      section = header[1]!.trim();
      if (!NESTED_SECTION_KEYS.has(section)) {
        return null;
      }
      out[section] = {};
      sawStructured = true;
      continue;
    }

    const pair = line.match(/^([^:]+):\s*(.+)$/);
    if (!pair) {
      return null;
    }

    const key = pair[1]!.trim();
    const value = safeJsonOrYamlParse(pair[2]!.trim());
    sawStructured = true;

    if (
      section &&
      !PERSONA_KEYS.has(key.toLowerCase()) &&
      !RESERVED_WORLD_ROOT_KEYS.has(key) &&
      typeof out[section] === "object" &&
      out[section] !== null &&
      !Array.isArray(out[section])
    ) {
      (out[section] as Record<string, SerialValue>)[key] = value;
      continue;
    }

    section = null;
    out[key] = value;
  }

  return sawStructured ? out : null;
}

const RESERVED_WORLD_ROOT_KEYS = new Set(["kind", "public", "private", "location"]);

function cloneLocationValue(value: SerialValue): SerialValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  return { ...(value as Record<string, SerialValue>) };
}

export function resolveEntityPersona(speaker: string, ctx: StoryEventContext): string {
  const entity = ctx.session.entities[speaker];
  if (!entity) {
    return "";
  }
  return entity.persona;
}
