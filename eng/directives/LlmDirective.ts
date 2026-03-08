import { SerialValue } from "../../lib/CoreTypings";
import { unwrapAsString } from "../../lib/EvalCasting";
import { buildPromptWithMode, gatherPromptAndSchemaForLLM, looseToJsonSchema, normalizeModelList } from "../Execution";
import { LLM_TYPE, StoryDirectiveFuncDef } from "../Helpers";

/**
 * ## LLM
 *
 * **Summary**
 * Call a language model and capture its output.
 *
 * **Syntax**
 * ```dramatoric
 * result = LLM: GENERATE DO
 *   ...
 * END
 *
 * result = LLM: PARSE; models (model/a, model/b) DO
 *   SCHEMA: DO
 *     ...
 *   END
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * summary = LLM: GENERATE DO
 *   Describe {{scene}} in two vivid sentences.
 * END
 * ```
 *
 * ```dramatoric
 * analysis = LLM: CLASSIFY DO
 *   USER PROMPT:
 *   I am a tightrope walker and I vote Democrat.
 *
 *   SCHEMA: DO
 *     circusPerformer = float -1 to 1
 *   END
 * END
 * ```
 *
 * ```dramatoric
 * someVar = LLM: PARSE; models (openai/gpt-4o-mini, anthropic/claude-sonnet-4.5) DO
 *   SCHEMA: DO
 *     move = enum run | fight | hide
 *   END
 * END
 * ```
 *
 * ```dramatoric
 * myVar = LLM: DO
 *   SYSTEM PROMPT:
 *   You are a helpful AI assistant. Answer the user's question.
 *
 *   USER PROMPT:
 *   Where is Paris?
 *
 *   SCHEMA: DO
 *     answer: string of your answer to the user
 *   END
 * END
 * ```
 *
 * **Notes**
 * - Subcommands: PARSE, GENERATE, CLASSIFY, NORMALIZE (first one wins).
 * - SYSTEM PROMPT, USER PROMPT, and SCHEMA are optional.
 * - Use `models (...)` to hint preferred model(s). Unknown model entries are ignored.
 */
export const LLM_directive: StoryDirectiveFuncDef = {
  type: [LLM_TYPE],
  func: async (node, ctx, pms) => {
    const { instructions, schema: looseSchema } = await gatherPromptAndSchemaForLLM(
      node,
      ctx,
      true, // Include "bare" content
    );
    const { prompt } = buildPromptWithMode(pms.pairs);
    if (prompt) {
      instructions.unshift({ role: "system", content: prompt });
    }
    const models = normalizeModelList(pms.pairs.models);
    const schema = await looseToJsonSchema(looseSchema, ctx);
    const result = await ctx.llm(instructions, schema, { models });
    const hasSchema = Object.keys(looseSchema).length > 0;
    const value = (hasSchema ? result : unwrapAsString(result)) as SerialValue;
    return [value];
  },
};
