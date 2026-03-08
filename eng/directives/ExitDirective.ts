import { ENGINE, EXIT_TYPE, StoryDirectiveFuncDef, StoryEventType } from "../Helpers";

/**
 * ## EXIT
 *
 * **Summary**
 * End the current handler and signal that the story is exiting.
 *
 * **Syntax**
 * ```dramatoric
 * EXIT:
 * ```
 *
 * **Examples**
 * ```dramatoric
 * IF: playerChoice == "quit" DO
 *   EXIT:
 * END
 * ```
 *
 * ```dramatoric
 * ON: $exit DO
 *   HOST: Thanks for playing.
 * END
 * ```
 *
 * **Notes**
 * - Use `ON: $exit` to react to an exit signal.
 */
export const EXIT_directive: StoryDirectiveFuncDef = {
  type: [EXIT_TYPE],
  func: async (node, ctx) => {
    console.info("[EXIT]");

    // Reset current handler's checkpoint (restarts from beginning)
    const handler = ctx.handler;
    if (handler >= 0) {
      delete ctx.session.checkpoints[handler];
    }

    ctx.emit({
      type: StoryEventType.$exit,
      channel: "engine",
      from: ENGINE,
    });
  },
};
