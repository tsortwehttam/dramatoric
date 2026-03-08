import { castToString } from "../../lib/EvalCasting";
import { EMIT_TYPE, ENGINE, StoryDirectiveFuncDef } from "../Helpers";

/**
 * ## EMIT
 *
 * **Summary**
 * Fire a custom event that you can handle with ON.
 *
 * **Syntax**
 * ```dramatoric
 * EMIT: eventType
 * EMIT: eventType; key value; other "value"
 * EMIT: type eventType; key value
 * ```
 *
 * **Examples**
 * ```dramatoric
 * EMIT: someEvent
 * ```
 *
 * ```dramatoric
 * EMIT: someEvent; from hero; mood "tense"
 * ```
 *
 * ```dramatoric
 * EMIT: type someEvent; from hero; mood "tense"
 * ```
 *
 * **Notes**
 * - If the first parameter is a bare token, it becomes the event `type`.
 * - Additional parameters become fields on the emitted event.
 */
export const EMIT_directive: StoryDirectiveFuncDef = {
  type: [EMIT_TYPE],
  func: async (node, ctx, pms) => {
    if (pms.artifacts.length < 1) {
      return [];
    }
    const inlineType = castToString(pms.artifacts[0] ?? "");
    const declaredType = pms.trailers.type ? castToString(pms.trailers.type) : null;
    if (inlineType && declaredType && inlineType !== declaredType) {
      console.warn("EMIT conflicting type declarations");
      return [];
    }
    const eventType = declaredType ?? inlineType;
    if (!eventType) {
      console.warn("EMIT requires a 'type' when passing payload arguments");
      return [];
    }
    const attrs = { ...pms.trailers };
    delete attrs.type;
    const event = ctx.emit({
      type: eventType,
      from: ENGINE,
      ...attrs,
      channel: "emit",
    });
    return [event];
  },
};
