import { GOTO_TYPE, readNamedClause, SCENE_TYPE, StoryDirectiveFuncDef } from "../Helpers";

/**
 * ## SCENE
 *
 * **Summary**
 * Define a named scene that can be jumped to with GOTO.
 *
 * **Syntax**
 * ```dramatoric
 * SCENE: Scene Name DO
 *   ...
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * SCENE: Market DO
 *   NARRATOR:
 *   Stalls line the cobblestone street.
 *
 *   GOTO: Town Square
 * END
 *
 * SCENE: Town Square DO
 *   NARRATOR:
 *   The fountain gurgles quietly.
 * END
 *
 * GOTO: Market
 * ```
 *
 * **Notes**
 * - Defining a SCENE does not play it immediately.
 * - Scenes are jump targets for GOTO, similar to how BLOCKs are targets for RUN.
 * - Unlike RUN, GOTO transfers flow permanently (does not return to the caller).
 * - Use `$visits` inside a scene to check how many times it has been entered.
 */
export const SCENE_directive: StoryDirectiveFuncDef = {
  type: [SCENE_TYPE],
  func: async () => {
    // No-op; scenes are registered during context initialization.
  },
};

/**
 * ## GOTO
 *
 * **Summary**
 * Jump to a named SCENE, transferring flow permanently.
 *
 * **Syntax**
 * ```dramatoric
 * GOTO: Scene Name
 * ```
 *
 * **Examples**
 * ```dramatoric
 * SCENE: Kitchen DO
 *   NARRATOR:
 *   The smell of fresh bread fills the air.
 * END
 *
 * GOTO: Kitchen
 * ```
 *
 * **Notes**
 * - GOTO does not return to the caller. Flow continues from the target scene.
 * - GOTO works from inside loops, conditionals, and blocks — it unwinds the entire call stack.
 * - Chained GOTOs are supported (a scene can GOTO another scene).
 * - A hop counter prevents infinite GOTO loops (max 1000 hops per step).
 */
export const GOTO_directive: StoryDirectiveFuncDef = {
  type: [GOTO_TYPE],
  func: async (node, ctx, pms) => {
    const name = readNamedClause(pms);
    if (!ctx.scenes[name]) {
      console.warn(`GOTO target not found: ${name}`);
      return;
    }
    ctx.goto = name;
    ctx.halted = true;
  },
};
