import { allTruthy } from "../../lib/EvalCasting";
import { executeKids, renderHandlebarsAndDDV } from "../Execution";
import {
  BREAK_TYPE,
  LOOP_TYPE,
  marshallParams,
  STATE_ITERATION_KEY,
  StoryDirectiveFuncDef,
  WHILE_TYPE,
} from "../Helpers";

/**
 * ## WHILE / LOOP
 *
 * **Summary**
 * Repeat a block while a condition remains true.
 *
 * **Syntax**
 * ```dramatoric
 * WHILE: condition DO
 *   ...
 * END
 *
 * LOOP: condition DO
 *   ...
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * WHILE: coins > 0 DO
 *   SET: coins {{coins - 1}}
 * END
 * ```
 *
 * ```dramatoric
 * WHILE: true DO
 *   nextAction = INPUT:
 *
 *   IF: $iteration > 2 DO
 *     GOTO: Calm Down
 *   END
 * END
 * ```
 *
 * ```dramatoric
 * WHILE: true DO
 *   choice = INPUT:
 *
 *   IF: choice == "quit" DO
 *     BREAK:
 *   END
 * END
 * ```
 *
 * ```dramatoric
 * WHILE: true DO |i|
 *   LOG: iteration {{i}}
 * END
 * ```
 *
 * **Notes**
 * - `$iteration` starts at `0` and increments after each loop.
 * - Use pipe syntax (`|i|`) to name your own iteration variable.
 * - Use BREAK to exit early.
 */
export const WHILE_directive: StoryDirectiveFuncDef = {
  type: [WHILE_TYPE, LOOP_TYPE],
  func: async (node, ctx, pms, eaves) => {
    ctx.session.stack.push({});
    ctx.set(STATE_ITERATION_KEY, 0, true);
    if (eaves[0]) ctx.set(eaves[0], 0, true);
    const prevBreak = ctx.break;
    let shouldBreak = false;
    ctx.break = () => {
      console.info("[BREAK]");
      shouldBreak = true;
    };
    let force = isPrefix(ctx.path, ctx.resume);
    function doLoop(iter: number): boolean {
      if (force) {
        return true;
      }
      if (iter === 0) {
        return allTruthy(pms.artifacts);
      }
      const rendered = renderHandlebarsAndDDV(node.args, ctx).trim();
      const recalc = marshallParams(rendered, ctx.evaluate);
      return allTruthy(recalc.artifacts);
    }
    let i = 0;
    while (doLoop(i)) {
      if (ctx.exited) {
        ctx.break = prevBreak;
        ctx.session.stack.pop();
        return;
      }
      force = false;
      shouldBreak = false;
      await executeKids(node.kids, ctx);
      if (ctx.halted) {
        ctx.break = prevBreak;
        ctx.session.stack.pop();
        return;
      }
      if (shouldBreak) {
        break;
      }
      i += 1;
      ctx.set(STATE_ITERATION_KEY, i, true);
      if (eaves[0]) ctx.set(eaves[0], i, true);
    }
    ctx.break = prevBreak;
    ctx.session.stack.pop();
  },
};

function isPrefix(path: number[], resume: number[]) {
  if (resume.length <= path.length) return false;
  for (let i = 0; i < path.length; i++) {
    if (resume[i] !== path[i]) return false;
  }
  return true;
}

/**
 * ## BREAK
 *
 * **Summary**
 * Exit the nearest WHILE/LOOP early.
 *
 * **Syntax**
 * ```dramatoric
 * BREAK:
 * ```
 *
 * **Examples**
 * ```dramatoric
 * coins = 3
 *
 * WHILE: coins > 0 DO
 *   choice = INPUT:
 *
 *   IF: choice == "quit" DO
 *     BREAK:
 *   END
 *
 *   SET: coins {{coins - 1}}
 * END
 * ```
 *
 * **Notes**
 * - BREAK is only valid inside WHILE or LOOP.
 */
export const BREAK_directive: StoryDirectiveFuncDef = {
  type: [BREAK_TYPE],
  func: async (node, ctx, pms) => {
    if (!ctx.break) {
      console.warn("BREAK is only supported inside WHILE directives");
      return;
    }
    ctx.break();
  },
};
