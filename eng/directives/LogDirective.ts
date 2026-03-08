import { SerialValue } from "../../lib/CoreTypings";
import { readBody } from "../Execution";
import { LOG_TYPE, StoryDirectiveFuncDef } from "../Helpers";

/**
 * ## LOG
 *
 * **Summary**
 * Write debug information while authoring or running a story.
 *
 * **Syntax**
 * ```dramatoric
 * LOG: expression
 * LOG: expression DO
 *   ...
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * LOG: heroStats
 * ```
 *
 * ```dramatoric
 * LOG: heroStats DO
 *   Checking hero stats at {{time}}
 * END
 * ```
 *
 * ```dramatoric
 * LOG: {{player.hp}} DO
 *   HP before encounter is {{player.hp}}
 * END
 * ```
 *
 * **Notes**
 * - LOG does not affect story flow.
 * - The optional body is rendered and included with the log output.
 */
export const LOG_directive: StoryDirectiveFuncDef = {
  type: [LOG_TYPE],
  func: async (node, ctx, pms) => {
    const argExpr = pms.text.trim();
    const argValue = pms.artifacts[0] ?? null;
    const body = await readBody(node, ctx);
    const payload: Record<string, SerialValue> = {};
    if (argExpr) {
      payload.args = argValue;
    }
    if (body) {
      payload.body = body;
    }
    if (Object.keys(payload).length < 1) {
      console.info("[LOG]", ctx.session.state);
    } else {
      console.info("[LOG]", payload);
    }
    return [payload];
  },
};
