import { executeKids, selectCaseKids } from "../Execution";
import { CASE_TYPE, StoryDirectiveFuncDef } from "../Helpers";
import { createLLMYieldIfFunc } from "../Processor";

/**
 * ## CASE
 *
 * **Summary**
 * Branch on a single expression by matching it against WHEN clauses.
 *
 * **Syntax**
 * ```dramatoric
 * CASE: expression DO
 *   WHEN: value DO
 *     ...
 *   END
 *
 *   ELSE: DO
 *     ...
 *   END
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * mood = "calm"
 *
 * CASE: mood DO
 *   WHEN: "calm" DO
 *     HOST:
 *     You breathe slowly.
 *   END
 *
 *   WHEN: "tense" DO
 *     HOST:
 *     Your pulse quickens.
 *   END
 *
 *   ELSE: DO
 *     HOST:
 *     You steady yourself.
 *   END
 * END
 * ```
 *
 * **Notes**
 * - The first WHEN that matches runs; ELSE runs if nothing matches.
 * - WHEN and ELSE are only valid inside CASE.
 */
export const CASE_directive: StoryDirectiveFuncDef = {
  type: [CASE_TYPE],
  func: async (node, ctx, pms) => {
    const kids = await selectCaseKids(node, ctx, createLLMYieldIfFunc(ctx));
    await executeKids(kids, ctx);
  },
};
