import { readBody } from "../Execution";
import { CODE_TYPE, marshallParams, StoryDirectiveFuncDef } from "../Helpers";

/**
 * ## CODE
 *
 * **Summary**
 * Run a short scripting block when you need more complex expressions.
 *
 * **Syntax**
 * ```dramatoric
 * CODE: DO
 *   a = 1 + 2; b = a * 3
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * result = CODE: DO
 *   a = 10; b = 2; a / b
 * END
 * ```
 *
 * **Notes**
 * - Separate expressions with semicolons (`;`).
 */
export const CODE_directive: StoryDirectiveFuncDef = {
  type: [CODE_TYPE],
  func: async (node, ctx, pms) => {
    const src = await readBody(node, ctx);
    const params = marshallParams(src, ctx.evaluate);
    return params.artifacts;
  },
};
