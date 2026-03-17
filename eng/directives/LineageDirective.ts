import { SerialValue } from "../../lib/CoreTypings";
import { BlendStrategy } from "../../lib/NPC";
import { parseNumberOrNull } from "../../lib/MathHelpers";
import { readBody } from "../Execution";
import { LINEAGE_TYPE, StoryDirectiveFuncDef } from "../Helpers";

const VALID_BLEND_RULES = new Set<string>(["average", "mother", "father"]);
const DEFAULT_DEPTH = 2;
const SECTION_KEYS = new Set(["adam", "eve", "blend", "traits"]);

function parseLineageBody(body: string): Record<string, Record<string, SerialValue>> {
  const sections: Record<string, Record<string, SerialValue>> = {};
  let current = "";
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    if (!val && SECTION_KEYS.has(key)) {
      current = key;
      if (!sections[current]) sections[current] = {};
      continue;
    }
    if (current && key) {
      sections[current] = sections[current] ?? {};
      sections[current][key] = coerce(val);
    }
  }
  return sections;
}

function coerce(v: string): SerialValue {
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  const n = parseNumberOrNull(v);
  if (n !== null) return n;
  return v.replace(/^["']|["']$/g, "");
}

/**
 * ## LINEAGE
 *
 * **Summary**
 * Declare a named population lineage backed by deterministic genealogy.
 * The body defines ancestor traits (adam/eve), blend rules, and optionally
 * per-NPC trait overrides. Entities link into a lineage via the `npc` param.
 *
 * **Syntax**
 * ```dramatoric
 * LINEAGE: Meryton DO
 *   adam:
 *     surname: Bennet
 *     hairColor: brown
 *   eve:
 *     surname: Gardiner
 *     hairColor: auburn
 *   blend:
 *     surname: father
 *     hairColor: average
 * END
 * ```
 *
 * **Notes**
 * - `adam` and `eve` define the founding ancestor traits.
 * - `blend` maps trait keys to blend strategies: "average", "mother", or "father".
 * - Optional `depth` param controls default ancestry depth for persona injection (default 2).
 * - Link entities with `ENTITY: NAME; npc LineageName 42`.
 */
export const LINEAGE_directive: StoryDirectiveFuncDef = {
  type: [LINEAGE_TYPE],
  func: async (node, ctx, pms) => {
    const name = pms.keys[0];
    if (!name) return;

    const body = await readBody(node, ctx);
    const sections = parseLineageBody(body);

    const adam = (sections.adam ?? {}) as Record<string, SerialValue>;
    const eve = (sections.eve ?? {}) as Record<string, SerialValue>;

    const rawBlend = sections.blend ?? {};
    const blend: Record<string, BlendStrategy> = {};
    for (const [k, v] of Object.entries(rawBlend)) {
      if (typeof v === "string" && VALID_BLEND_RULES.has(v)) {
        blend[k] = v as BlendStrategy;
      }
    }

    const traits: Record<string, Record<string, SerialValue>> = {};
    const rawTraits = sections.traits ?? {};
    for (const [k, v] of Object.entries(rawTraits)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        traits[k] = v as Record<string, SerialValue>;
      }
    }

    const depth = typeof pms.trailers.depth === "number" ? pms.trailers.depth : DEFAULT_DEPTH;

    ctx.session.lineages[name] = { adam, eve, blend, depth, traits };
    return [name];
  },
};
