import { castToNumber } from "../../lib/EvalCasting";
import { clamp } from "../../lib/MathHelpers";
import { executeKids } from "../Execution";
import { StoryDirectiveFuncDef, VARY_OMIT_KEY, VARY_PICK_KEY, VARY_SHUFFLE_KEY, VARY_TYPE } from "../Helpers";

/**
 * ## VARY
 *
 * **Summary**
 * Add controlled variability: shuffle, omit a fraction, or pick a fixed count.
 *
 * **Syntax**
 * ```dramatoric
 * VARY: SHUFFLE DO
 *   ...
 * END
 *
 * VARY: SHUFFLE; OMIT 0.5 DO
 *   ...
 * END
 *
 * VARY: PICK 2 DO
 *   ...
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * VARY: SHUFFLE DO
 *   HOST:
 *   Line one
 *
 *   HOST:
 *   Line two
 * END
 * ```
 *
 * ```dramatoric
 * VARY: SHUFFLE; OMIT 0.8 DO
 *   HOST:
 *   A
 *
 *   HOST:
 *   B
 *
 *   HOST:
 *   C
 * END
 * ```
 *
 * ```dramatoric
 * VARY: PICK 2 DO
 *   HOST:
 *   Alpha
 *
 *   HOST:
 *   Beta
 *
 *   HOST:
 *   Gamma
 * END
 * ```
 *
 * **Notes**
 * - `SHUFFLE` randomizes order; `OMIT` drops a fraction; `PICK` selects a count.
 * - If `PICK` is provided, `OMIT` is ignored.
 */
export const VARY_directive: StoryDirectiveFuncDef = {
  type: [VARY_TYPE],
  func: async (node, ctx, pms) => {
    let kids = node.kids;
    let shouldShuffle = false;
    let omitRatio: number | null = null;
    let pickCount: number | null = null;
    for (const key in pms.pairs) {
      const value = pms.pairs[key];
      switch (key) {
        case VARY_SHUFFLE_KEY:
          shouldShuffle = true;
          break;
        case VARY_OMIT_KEY:
          omitRatio = clamp(castToNumber(value), 0.0, 1.0);
          break;
        case VARY_PICK_KEY:
          pickCount = Math.max(0, Math.floor(castToNumber(value)));
          break;
      }
    }
    if (shouldShuffle) {
      kids = ctx.rng.shuffle(kids);
    }
    if (pickCount !== null) {
      const count = Math.min(pickCount, kids.length);
      const source = shouldShuffle ? kids : ctx.rng.shuffle(kids);
      kids = source.slice(0, count);
    } else if (omitRatio !== null) {
      const keep = Math.max(0, Math.floor((1 - omitRatio) * kids.length));
      const source = shouldShuffle ? kids : ctx.rng.shuffle(kids);
      kids = source.slice(0, keep);
    }
    await executeKids(kids, ctx);
  },
};
