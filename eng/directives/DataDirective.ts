import { safeJsonOrYamlParse } from "../../lib/JSONAndYAMLHelpers";
import { readBody } from "../Execution";
import { DATA_TYPE, StoryDirectiveFuncDef } from "../Helpers";

/**
 * ## DATA
 *
 * **Summary**
 * Embed structured data (JSON or YAML) and assign it to a variable.
 *
 * **Syntax**
 * ```dramatoric
 * myData = DATA: DO
 *   ...
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * someVar = DATA: DO
 *   {"hello": "json"}
 * END
 * ```
 *
 * ```dramatoric
 * heroStats = DATA: DO
 *   hunger: 0
 *   mood: calm
 * END
 * ```
 *
 * **Notes**
 * - If parsing fails, the result is an empty object.
 */
export const DATA_directive: StoryDirectiveFuncDef = {
  type: [DATA_TYPE],
  func: async (node, ctx, pms) => {
    const text = await readBody(node, ctx);
    const parsedData = safeJsonOrYamlParse(text) ?? {};
    return [parsedData];
  },
};
