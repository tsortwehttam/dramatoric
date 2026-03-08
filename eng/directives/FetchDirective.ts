import { SerialValue } from "../../lib/CoreTypings";
import { fetchUrl } from "../Execution";
import { FETCH_TYPE, StoryDirectiveFuncDef } from "../Helpers";

/**
 * ## FETCH
 *
 * **Summary**
 * Fetch one or more URLs (HTTP GET) and return the response data.
 *
 * **Syntax**
 * ```dramatoric
 * result = FETCH: https://example.com
 * a, b = FETCH: url1; url2
 * ```
 *
 * **Examples**
 * ```dramatoric
 * myData = FETCH: https://www.example.com
 * ```
 *
 * ```dramatoric
 * heroProfile, heroInventory = FETCH: https://api.example.com/heroes/123; https://api.example.com/inventory/123
 * ```
 *
 * ```dramatoric
 * remoteUrl = "https://example.com/story"
 * rawDoc = FETCH: {{remoteUrl}}
 * ```
 *
 * **Notes**
 * - URLs are separated by semicolons; missing or failing requests yield `null`.
 * - Responses are returned as parsed JSON when possible, otherwise text.
 */
export const FETCH_directive: StoryDirectiveFuncDef = {
  type: [FETCH_TYPE],
  func: async (node, ctx, pms) => {
    if (pms.artifacts.length < 1) {
      return;
    }
    if (node.vars.length > 0) {
      const results: SerialValue[] = [];
      for (let i = 0; i < node.vars.length; i++) {
        const source = pms.artifacts[i];
        if (!source) {
          results.push(null);
          continue;
        }
        const result = await fetchUrl(ctx, source);
        results.push(result ?? null);
      }
      return results;
    }
    const entries = Object.entries(pms.pairs);
    if (entries.length === 0) {
      return;
    }
    const results: SerialValue[] = [];
    for (const [, value] of entries) {
      const result = await fetchUrl(ctx, value);
      if (result !== null) {
        results.push(result);
      }
    }
    return results.length > 0 ? results : undefined;
  },
};
