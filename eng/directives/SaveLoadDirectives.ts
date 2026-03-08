import { castToString } from "../../lib/EvalCasting";
import { isBlank } from "../../lib/TextHelpers";
import { LOAD_TYPE, SAVE_TYPE, StoryDirectiveFuncDef } from "../Helpers";

/**
 * ## SAVE
 *
 * **Summary**
 * Save the current session state under a string ID.
 *
 * **Syntax**
 * ```dramatoric
 * SAVE: "checkpoint_1"
 * ```
 *
 * **Examples**
 * ```dramatoric
 * SAVE: "checkpoint_1"
 * ```
 *
 * **Notes**
 * - The ID is rendered, so you can use expressions or interpolation.
 * - How and where saves are stored depends on your runtime.
 */
export const SAVE_directive: StoryDirectiveFuncDef = {
  type: [SAVE_TYPE],
  func: async (node, ctx, pms) => {
    const uid = castToString(pms.artifacts[0] ?? "");
    if (isBlank(uid)) {
      console.warn("SAVE requires a UID parameter");
      return;
    }
    await ctx.io({ kind: "save", uid, session: ctx.session });
    console.info(`[SAVE] saved session to '${uid}'`);
  },
};

/**
 * ## LOAD
 *
 * **Summary**
 * Load a saved session by ID and return it.
 *
 * **Syntax**
 * ```dramatoric
 * savedGame = LOAD: "checkpoint_1"
 * ```
 *
 * **Examples**
 * ```dramatoric
 * savedGame = LOAD: "checkpoint_1"
 * ```
 *
 * **Notes**
 * - Returns the saved session or `null` if none exists.
 * - The ID is rendered, so you can use expressions or interpolation.
 */
export const LOAD_directive: StoryDirectiveFuncDef = {
  type: [LOAD_TYPE],
  func: async (node, ctx, pms) => {
    const uid = castToString(pms.artifacts[0] ?? "");
    if (isBlank(uid)) {
      console.warn("LOAD requires a UID parameter");
      return [null];
    }
    const session = await ctx.io({ kind: "load", uid });
    const status = session ? "found" : "not found";
    console.info(`[LOAD] session '${uid}' ${status}`);
    return [session];
  },
};
