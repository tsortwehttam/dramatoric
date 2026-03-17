import { SerialValue } from "../../lib/CoreTypings";
import { formatAncestry } from "../../lib/LineageHelpers";
import { safeJsonOrYamlParse } from "../../lib/JSONAndYAMLHelpers";
import { isBlank } from "../../lib/TextHelpers";
import { readBody } from "../Execution";
import { ENTITY_TYPE, StoryDirectiveFuncDef, StoryEventContext, StoryEventType } from "../Helpers";

/**
 * ## ENTITY
 *
 * **Summary**
 * Declare or update a named entity with stats and a persona (modus).
 * The body is parsed in multiple passes: first as structured data (JSON/YAML),
 * then as raw persona text. Redeclaring the same entity merges stats and replaces
 * the modus.
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
 *   becomes the entity's modus and remaining fields become stats.
 * - If the body does not parse as structured data, it is treated as raw persona text.
 * - Inline parameters (after semicolons) are merged into stats.
 * - Redeclaring the same entity merges new stats and replaces the modus.
 * - When a speaker name matches a registered entity, the entity's persona is
 *   automatically injected into dialogue generation.
 * - Access entity stats with `stat("ENTITY_NAME", "statKey")`.
 */
export const ENTITY_directive: StoryDirectiveFuncDef = {
  type: [ENTITY_TYPE],
  func: async (node, ctx, pms) => {
    const name = pms.keys[0];
    if (!name) {
      return;
    }

    const body = await readBody(node, ctx);
    const { stats, persona } = parseEntityBody(body);

    // Merge inline params (after first key) as stats
    for (const key in pms.trailers) {
      stats[key] = pms.trailers[key];
    }

    // Parse npc param: "npc LineageName 42" stored as "LineageName 42" string
    let lineage = "";
    let npcId = -1;
    const npcRaw = pms.trailers.npc;
    if (typeof npcRaw === "string" && !isBlank(npcRaw)) {
      const parts = npcRaw.trim().split(/\s+/);
      if (parts.length >= 2) {
        lineage = parts[0];
        npcId = parseInt(parts[1], 10);
      }
    } else if (typeof npcRaw === "number") {
      // npc param was just an ID; check if the first trailer key is the lineage name
      const keys = Object.keys(pms.trailers);
      const npcIdx = keys.indexOf("npc");
      if (npcIdx > 0) {
        lineage = keys[npcIdx - 1];
      }
      npcId = npcRaw;
    }

    const existing = ctx.session.entities[name];
    if (existing) {
      Object.assign(existing.stats, stats);
      existing.modus = node;
      if (persona) {
        existing.persona = persona;
      }
      if (lineage) existing.lineage = lineage;
      if (npcId >= 0) existing.npcId = npcId;
    } else {
      ctx.session.entities[name] = {
        modus: node,
        persona,
        stats,
        lineage,
        npcId,
      };
    }

    // Also expose a flat state variable for simple access like {{RATZ.health}}
    ctx.set(name, { ...stats, persona } as SerialValue);

    const entity = ctx.session.entities[name];
    ctx.emit({
      type: StoryEventType.$entity,
      from: name,
      channel: "engine",
      result: { ...entity.stats, persona: entity.persona },
    });

    return [entity.stats];
  },
};

const PERSONA_KEYS = new Set(["persona", "modus", "description", "character", "bio"]);

function parseEntityBody(body: string): {
  stats: Record<string, SerialValue>;
  persona: string;
} {
  if (isBlank(body)) {
    return { stats: {}, persona: "" };
  }

  // Pass 1: Try structured data (JSON/YAML)
  const parsed = safeJsonOrYamlParse(body);
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

export function resolveEntityPersona(speaker: string, ctx: StoryEventContext): string {
  const entity = ctx.session.entities[speaker];
  if (!entity) {
    return "";
  }
  const { persona, lineage, npcId } = entity;
  if (!lineage || npcId < 0) {
    return persona;
  }
  const spec = ctx.session.lineages[lineage];
  if (!spec) {
    return persona;
  }
  const ancestry = formatAncestry(spec, npcId);
  return persona ? `${persona}\n\n${ancestry}` : ancestry;
}
