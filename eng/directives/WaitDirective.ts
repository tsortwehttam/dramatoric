import { castToString } from "../../lib/EvalCasting";
import { parseDurationToMs } from "../../lib/TextHelpers";
import { ENGINE, StoryDirectiveFuncDef, StoryEventType, WAIT_TYPE } from "../Helpers";

/**
 * ## WAIT
 *
 * **Summary**
 * Pause playback for a specified duration.
 *
 * **Syntax**
 * ```dramatoric
 * WAIT: duration 2000
 * WAIT: duration 2s
 * WAIT: duration 1.5s
 * ```
 *
 * **Examples**
 * ```dramatoric
 * HOST: You hear a whisper...
 * WAIT: duration 2s
 * HOST: ...from the dark.
 * ```
 *
 * **Notes**
 * - Duration can be milliseconds (`2000`) or seconds with `s` (`2s`, `1.5s`).
 * - If the duration is missing or invalid, the wait is ignored.
 */
export const WAIT_directive: StoryDirectiveFuncDef = {
  type: [WAIT_TYPE],
  func: async (node, ctx, pms) => {
    const raw = pms.pairs.duration;
    if (raw == null) {
      console.warn("WAIT requires a duration parameter");
      return;
    }
    const duration = parseDurationToMs(castToString(raw));
    if (duration === null) {
      console.warn("WAIT requires a numeric duration (e.g. 2000, 2s)");
      return;
    }
    ctx.emit({
      type: StoryEventType.$wait,
      channel: "engine",
      from: ENGINE,
      duration,
    });
  },
};
