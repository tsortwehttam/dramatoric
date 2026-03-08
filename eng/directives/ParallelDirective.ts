import { parallel } from "../../lib/AsyncHelpers";
import { executeNode } from "../Execution";
import { PARALLEL_TYPE, StoryDirectiveFuncDef } from "../Helpers";

/**
 * ## PARALLEL
 *
 * **Summary**
 * Run multiple blocks at the same time, then continue when all finish.
 *
 * **Syntax**
 * ```dramatoric
 * PARALLEL: DO
 *   ...
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * BLOCK: Branch A DO
 *   HOST:
 *   Path A begins.
 * END
 *
 * BLOCK: Branch B DO
 *   HOST:
 *   Path B begins.
 * END
 *
 * PARALLEL: DO
 *   RUN: Branch A
 *   RUN: Branch B
 * END
 * ```
 *
 * ```dramatoric
 * PARALLEL: DO
 *   SOUND:
 *   Water flowing down a ravine
 *
 *   WAIT: duration 2s
 * END
 * ```
 *
 * **Notes**
 * - Use PARALLEL for overlapping audio, timed events, or independent branches.
 */
export const PARALLEL_directive: StoryDirectiveFuncDef = {
  type: [PARALLEL_TYPE],
  func: async (node, ctx, pms) => {
    await parallel(node.kids, async (kid) => {
      await executeNode(kid, ctx);
    });
  },
};
