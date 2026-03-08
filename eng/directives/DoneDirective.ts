import { DONE_TYPE, StoryDirectiveFuncDef } from "../Helpers";

/**
 * ## DONE
 *
 * **Summary**
 * Permanently stop the current ON handler from running again.
 *
 * **Syntax**
 * ```dramatoric
 * DONE:
 * ```
 *
 * **Examples**
 * ```dramatoric
 * ON: $input DO
 *   HOST: Welcome to the story!
 *   name = CAPTURE:
 *   HOST: Hello, {{name.value}}! The adventure begins...
 *   DONE:
 * END
 * ```
 *
 * **Notes**
 * - Use DONE for one-time handlers like intros or tutorials.
 */
export const DONE_directive: StoryDirectiveFuncDef = {
  type: [DONE_TYPE],
  func: async (node, ctx) => {
    const handler = ctx.handler;
    if (handler >= 0) {
      ctx.session.handlers[handler] = true;
      delete ctx.session.checkpoints[handler];
    }
    ctx.halted = true;
    return [];
  },
};
