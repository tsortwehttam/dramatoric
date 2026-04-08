import { castToString } from "../../lib/EvalCasting";
import { executeNode, renderTemplateText } from "../Execution";
import { BLOCK_TYPE, cloneNode, INCLUDE_TYPE, readNamedClause, RUN_TYPE, StoryDirectiveFuncDef, TEMPLATE_TYPE } from "../Helpers";

/**
 * ## BLOCK
 *
 * **Summary**
 * Define a reusable block of story content that can be inserted later with RUN.
 *
 * **Syntax**
 * ```dramatoric
 * BLOCK: Block Name DO
 *   ...
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * BLOCK: Encounter Intro DO
 *   HOST:
 *   The encounter begins.
 * END
 *
 * BLOCK: Encounter Outro DO
 *   SOUND:
 *   Triumphant horns
 * END
 *
 * RUN: Encounter Intro
 * RUN: Encounter Outro; mood "brave"; speed 2
 * ```
 *
 * **Notes**
 * - Defining a BLOCK does not play it immediately.
 */

export const BLOCK_directive: StoryDirectiveFuncDef = {
  type: [BLOCK_TYPE],
  func: async (node, ctx, pms) => {
    // No-op; this should be handled when the engine is initialized in createContext()
  },
};

export const TEMPLATE_directive: StoryDirectiveFuncDef = {
  type: [TEMPLATE_TYPE],
  func: async () => {
    // No-op; this is registered when the engine context is created.
  },
};

/**
 * ## RUN
 *
 * **Summary**
 * Insert and execute the contents of a previously defined BLOCK.
 *
 * **Syntax**
 * ```dramatoric
 * RUN: Block Name
 * RUN: Block Name; key value; other "value"
 * ```
 *
 * **Examples**
 * ```dramatoric
 * BLOCK: Encounter Intro DO
 *   HOST:
 *   The encounter begins.
 * END
 *
 * RUN: Encounter Intro
 * RUN: Encounter Intro; mood "tense"
 * ```
 *
 * **Notes**
 * - Parameters after the semicolons become temporary variables during the RUN.
 * - If no BLOCK with that name exists, nothing happens.
 */
export const RUN_directive: StoryDirectiveFuncDef = {
  type: [RUN_TYPE],
  func: async (node, ctx, pms) => {
    const name = readNamedClause(pms);
    const found = ctx.blocks[name];
    if (!found) {
      console.warn(`Module not found: ${name}`);
      return;
    }
    ctx.session.visits[name] = (ctx.session.visits[name] ?? 0) + 1;
    ctx.session.stack.push({
      $visits: ctx.session.visits[name],
      ...pms.trailers,
    });
    const result = await executeNode(cloneNode(found), ctx);
    ctx.session.stack.pop();
    return result;
  },
};

export const INCLUDE_directive: StoryDirectiveFuncDef = {
  type: [INCLUDE_TYPE],
  func: async (node, ctx, pms) => {
    const name = readNamedClause(pms);
    const rendered = await renderTemplateText(name, pms.trailers, ctx);
    return [rendered];
  },
};
