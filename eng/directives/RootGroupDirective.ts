import { executeKids } from "../Execution";
import { BOOT_TYPE, GROUP_TYPE, ROOT_TYPE, StoryDirectiveFuncDef, WellNode } from "../Helpers";

/**
 * ## GROUP / ROOT
 *
 * **Summary**
 * GROUP lets you wrap sequential content inside a PARALLEL block. ROOT is a
 * reserved structural stanza and is not written directly by authors.
 *
 * **Syntax**
 * ```dramatoric
 * GROUP: DO
 *   ...
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * PARALLEL: DO
 *   GROUP: DO
 *     HOST:
 *     This runs in order.
 *   END
 *
 *   SOUND:
 *   A distant storm
 * END
 * ```
 *
 * **Notes**
 * - ROOT is reserved and not used directly in story scripts.
 */
export const ROOT_directive: StoryDirectiveFuncDef = {
  type: [ROOT_TYPE, GROUP_TYPE],
  func: async (node, ctx, pms) => {
    // Don't visit the BOOT action if we're at the root, otherwise BOOT will result
    // in us re-running the prelude(), leading to an infinite loop
    const visitable = node.type === ROOT_TYPE ? node.kids.filter((n: WellNode) => n.type !== BOOT_TYPE) : node.kids;
    return await executeKids(visitable, ctx);
  },
};
