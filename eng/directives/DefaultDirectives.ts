import { castToArray, castToString } from "../../lib/EvalCasting";
import { isBlank } from "../../lib/TextHelpers";
import { filterConversationEvents } from "../../lib/ValueHelpers";
import { readBody } from "../Execution";
import {
  BLOCK_TYPE,
  cleanSpokenText,
  ELSE_TYPE,
  extractEmbeddedSegments,
  MACRO_TYPE,
  PROMPT_SYSTEM_TYPE,
  PROMPT_USER_TYPE,
  SCENE_TYPE,
  SCHEMA_TYPE,
  StoryDirectiveFuncDef,
  TEXT_TYPE,
} from "../Helpers";
import { generateDialogue } from "../Processor";
import { buildEntityDialoguePrompt } from "../functions/CuePromptUtils";

/**
 * ## Reserved / Structural Stanzas
 *
 * **Summary**
 * These stanzas are reserved or structural and are only used inside other
 * directives. They do not produce output on their own.
 *
 * **Syntax**
 * ```dramatoric
 * // Reserved; not written directly.
 * ```
 *
 * **Examples**
 * ```dramatoric
 * // Reserved; not written directly.
 * ```
 *
 * **Notes**
 * - Use ELSE only inside IF, and WHEN only inside CASE.
 * - SYSTEM/USER PROMPT and SCHEMA are only valid inside LLM and CAPTURE.
 */
export const noop_directive: StoryDirectiveFuncDef = {
  type: [
    /**
     * Authors do not write TEXT node but it often appears in story ASTs as a
     * container node for text.
     */
    TEXT_TYPE,
    MACRO_TYPE, // Reserved
    BLOCK_TYPE, // Reserved
    SCENE_TYPE, // Reserved
    /**
     * ELSE is only used inside IF.
     */
    ELSE_TYPE,
    /**
     * WHEN is only used inside CASE.
     */
    PROMPT_USER_TYPE,
    /**
     * SCHEMA is an author's desired output schema for LLM or INPUT. It is only
     * used inside LLM and INPUT.
     */
    SCHEMA_TYPE,
    /**
     * SYSTEM is an author's system prompt intended for an LLM. It is only used
     * inside LLM and INPUT.
     */
    PROMPT_SYSTEM_TYPE,
  ],
  func: async (node, ctx, pms) => void 0,
};

/**
 * ## Dialogue Stanzas (Default)
 *
 * **Summary**
 * Any stanza header that is not a directive is treated as a speaker name, and
 * its body is spoken as dialogue.
 *
 * **Syntax**
 * ```dramatoric
 * SPEAKER:
 * Spoken line(s) here.
 * ```
 *
 * **Examples**
 * ```dramatoric
 * HOST:
 * Once upon a time... (gravely) Lightning struck.
 *
 * SARAH:
 * (softly) It's going to be alright.
 * ```
 *
 * ```dramatoric
 * FRANK: to JIM
 * << You are Frank, a gruff used car salesman. Be pushy but funny. >>
 * ```
 *
 * ```dramatoric
 * BOB:
 * Hey you! << angry command to stop >> Show me some ID!
 * ```
 *
 * **Notes**
 * - Parentheses set emotional tone and are not spoken aloud.
 * - `<< >>` blocks are inline LLM generation slots. Authored text around them
 *   is preserved literally, and the LLM generates content to fill each slot.
 * - If the speaker is a registered entity, the entity's authored context is
 *   always layered in as base context for LLM generation, even when explicit `<< >>` blocks
 *   are present.
 */
export const fallthru_directive: StoryDirectiveFuncDef = {
  type: [],
  func: async (node, ctx, pms) => {
    const speaker = node.type;
    if (ctx.ops[speaker]) {
      return ctx.ops[speaker](node, ctx, pms.pairs);
    }

    const body = await readBody(node, ctx);

    const to = castToArray(pms.pairs.to ?? []).map(castToString);
    const obs = castToArray(pms.pairs.obs ?? []).map(castToString);
    const excl = castToArray(pms.pairs.excl ?? []).map(castToString);
    const eventOpts = { to, obs, excl };

    let segments = extractEmbeddedSegments(body);
    const hasPrompt = segments.some((s) => s.kind === "prompt");
    const prompt = buildEntityDialoguePrompt(speaker, ctx);

    // No <<>> and no entity context → pure authored text
    if (!hasPrompt && isBlank(prompt)) {
      const text = cleanSpokenText(body);
      ctx.say(speaker, text, eventOpts);
      return [text];
    }

    // Entity with no <<>> → treat whole body as a single prompt slot
    if (!hasPrompt && !isBlank(prompt)) {
      segments = [{ kind: "prompt", value: "Speak in character.", params: {} }];
    }

    const model = castToString(pms.pairs.model ?? "");
    const models = isBlank(model) ? ["WRITING"] : [model];
    const participants = [speaker, ...to];
    const history = filterConversationEvents(ctx.session.history, participants);
    const text = await generateDialogue(ctx, speaker, segments, prompt, history, models);
    ctx.say(speaker, text, eventOpts);
    return [text];
  },
};
