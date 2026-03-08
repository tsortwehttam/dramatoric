import { SerialValue } from "../../lib/CoreTypings";
import { readBody } from "../Execution";
import { SET_TYPE, StoryDirectiveFuncDef } from "../Helpers";

/**
 * ## SET
 *
 * **Summary**
 * Set one or more state variables.
 *
 * **Syntax**
 * ```dramatoric
 * SET: key value
 * SET: key value; otherKey otherValue
 * SET: key DO
 *   multi-line text
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * SET: foo 1
 * ```
 *
 * ```dramatoric
 * SET: foo hello there
 * SET: foo "hello there"
 * ```
 *
 * ```dramatoric
 * SET: foo 1; bar "I like cats; I like the way they purr"; baz -1.23
 * ```
 *
 * ```dramatoric
 * SET: desc DO
 *   Any content you put in here becomes a single string.
 * END
 * ```
 *
 * **Notes**
 * - Variable names use letters, numbers, and underscores.
 * - Use quotes if a value contains semicolons.
 */
export const SET_directive: StoryDirectiveFuncDef = {
  type: [SET_TYPE],
  func: async (node, ctx, pms) => {
    if (pms.tokens.length < 1) {
      return;
    }
    const body = await readBody(node, ctx);
    const values: SerialValue[] = [];
    for (const key in pms.pairs) {
      if (pms.pairs[key] === null) {
        values.push(body);
        ctx.set(key, body);
      } else {
        values.push(pms.pairs[key]);
        ctx.set(key, pms.pairs[key]);
      }
    }
    return values;
  },
};
