import { SerialValue } from "../../lib/CoreTypings";
import { castToString, safeGet, unwrapAsString } from "../../lib/EvalCasting";
import { isBlank } from "../../lib/TextHelpers";
import {
  applySuspendCheckpoint,
  buildPromptWithMode,
  gatherPromptAndSchemaForLLM,
  looseToJsonSchema,
  normalizeModelList,
} from "../Execution";
import { CAPTURE_TYPE, StoryDirectiveFuncDef } from "../Helpers";

/**
 * ## CAPTURE
 *
 * **Summary**
 * Pause an ON handler and resume it on the next matching event, optionally
 * transforming the input.
 *
 * **Syntax**
 * ```dramatoric
 * CAPTURE:
 * name = CAPTURE:
 * answer = CAPTURE: NORMALIZE DO
 *   Normalize to: yes, no
 * END
 * answer = CAPTURE: NORMALIZE; models (anthropic/claude-sonnet-4.5) DO
 *   Normalize to: yes, no
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * ON: $input DO
 *   HOST: What's your name?
 *   name = CAPTURE:
 *   HOST: Hello, {{name.value}}!
 * END
 * ```
 *
 * ```dramatoric
 * ON: $input DO
 *   HOST: Yes or no?
 *   answer = CAPTURE: NORMALIZE DO
 *     Normalize to: yes, no
 *   END
 *   HOST: You said {{answer.result}}.
 * END
 * ```
 *
 * **Notes**
 * - The assigned variable receives the input event object.
 * - Use `.value` for the raw input and `.result` for the normalized result.
 * - Use `models (...)` to hint preferred model(s) for normalization.
 */
export const CAPTURE_directive: StoryDirectiveFuncDef = {
  type: [CAPTURE_TYPE],
  func: async (node, ctx, pms) => {
    const param = castToString(pms.pairs.param ?? "").trim();
    if (param) {
      const value = safeGet(ctx.session.params, param);
      if (value !== null) {
        return [reifyCapturedEvent(ctx.event, value)];
      }
    }

    if (applySuspendCheckpoint(ctx)) {
      return [];
    }

    const input = ctx.event.value ?? ctx.event.raw ?? "";
    if (isBlank(input)) {
      return [ctx.event];
    }

    const { prompt } = buildPromptWithMode(pms.pairs);
    const { instructions, schema: looseSchema } = await gatherPromptAndSchemaForLLM(node, ctx, true);
    if (prompt) {
      instructions.unshift({ role: "system", content: prompt });
    }
    instructions.push({ role: "user", content: input });
    const models = normalizeModelList(pms.pairs.models);
    const schema = await looseToJsonSchema(looseSchema, ctx);
    const response = await ctx.llm(instructions, schema, { models });

    const hasSchema = Object.keys(looseSchema).length > 0;
    let result: SerialValue = hasSchema ? (response as SerialValue) : unwrapAsString(response);
    if (isBlank(result)) {
      result = input;
    }
    ctx.event.result = result;

    return [ctx.event];
  },
};

function reifyCapturedEvent(event: { raw: string; value: string; result: SerialValue }, value: SerialValue) {
  const text = reifyCapturedText(value);
  return {
    ...event,
    raw: text,
    value: text,
    result: value,
  };
}

function reifyCapturedText(value: SerialValue): string {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
