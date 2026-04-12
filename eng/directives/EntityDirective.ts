import { readBody } from "../Execution";
import { parseEntityBody } from "../EntityParseHelpers";
import { createEntityEntries, mergeEntityEntries } from "../functions/EntityEntryHelpers";
import { setEntityEntries } from "../functions/WorldFunctions";
import {
  ENTITY_TYPE,
  PERSON_TYPE,
  PLACE_TYPE,
  StoryEntityEntry,
  StoryDirectiveFuncDef,
  THING_TYPE,
  readNamedClause,
} from "../Helpers";

/**
 * ## ENTITY
 *
 * **Summary**
 * Declare or update a named entity with authored entries and derived world state.
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
 *   health: 100
 *   mood: calm
 *   You are Ratz, a grizzled bartender with a Russian accent.
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
 *   @mood: guarded
 *   goal: get home
 *   place: JURY ROOM
 *   rel: in
 *   You are Alice, a skeptical juror.
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * ENTITY: GUARD DO
 *   health: 50
 *   You are a stern palace guard.
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
 * - Loose text lines are included in the entity's authored prompt context.
 * - Inline parameters (after semicolons) are merged into stats.
 * - Redeclaring the same entity merges structured fields and replaces loose prompt lines if new ones are present.
 * - Known fields like `place`, `pos`, `sprite`, and `kind` are routed into
 *   internal world-state buckets.
 * - `@field:` marks a field as public; unmarked fields are private by default.
 * - Changing `location.place` on an existing entity emits `location.move`
 *   plus derived `location.exit` and `location.enter` events.
 * - When a speaker name matches a registered entity, its authored entries are
 *   injected into dialogue generation.
 * - Access entity stats with `stat("ENTITY_NAME", "statKey")`.
 */
export const ENTITY_directive: StoryDirectiveFuncDef = {
  type: [ENTITY_TYPE, PERSON_TYPE, PLACE_TYPE, THING_TYPE],
  func: async (node, ctx, pms) => {
    const name = pms.clauses[0]?.trim() ?? readNamedClause(pms);
    if (!name) {
      return;
    }

    const body = await readBody(node, ctx);
    const parsed = parseEntityBody(body);
    const entries = createEntityEntries(parsed.entries, ctx.rng.next);

    const extra: StoryEntityEntry[] = [];
    for (const key in pms.trailers) {
      extra.push({
        id: ctx.event.id,
        path: key,
        value: pms.trailers[key],
        public: false,
        mutable: false,
      });
    }
    const inferred = readInferredKind(node.type);
    if (inferred && !entries.some((item) => item.path === "kind")) {
      extra.push({
        id: ctx.event.id,
        path: "kind",
        value: inferred,
        public: false,
        mutable: false,
      });
    }
    const incoming = [...entries, ...extra].map((entry, i) => ({
      ...entry,
      id: entry.id === ctx.event.id ? `${ctx.event.id}:${i}` : entry.id,
    }));

    const existing = ctx.session.entities[name];
    if (existing) {
      existing.entries = mergeEntityEntries(existing.entries, incoming, true);
      setEntityEntries(ctx, name, existing.entries);
      return [ctx.session.entities[name].stats];
    }

    ctx.session.entities[name] = {
      entries: incoming,
      stats: {},
    };
    setEntityEntries(ctx, name, incoming);
    return [ctx.session.entities[name].stats];
  },
};

function readInferredKind(type: string): string {
  if (type === PERSON_TYPE) {
    return "person";
  }
  if (type === PLACE_TYPE) {
    return "place";
  }
  if (type === THING_TYPE) {
    return "thing";
  }
  return "";
}
