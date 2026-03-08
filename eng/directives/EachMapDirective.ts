import { SerialValue } from "../../lib/CoreTypings";
import { castToArray } from "../../lib/EvalCasting";
import { executeNode } from "../Execution";
import {
  EACH_TYPE,
  MAP_TYPE,
  STATE_ARRAY_KEY,
  STATE_ELEMENT_KEY,
  STATE_INDEX_KEY,
  StoryDirectiveFuncDef,
  wrapKids,
} from "../Helpers";

/**
 * ## EACH / MAP
 *
 * **Summary**
 * Iterate over one or more arrays and run the body once per element. MAP is an
 * alias that returns the collected results.
 *
 * **Syntax**
 * ```dramatoric
 * EACH: array DO
 *   ...
 * END
 *
 * EACH: array DO |item, idx|
 *   ...
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * items = DATA: DO
 *   - red
 *   - green
 *   - blue
 * END
 *
 * EACH: items DO
 *   SET: outerVar $index
 * END
 * ```
 *
 * ```dramatoric
 * numbers = DATA: DO
 *   - 10
 *   - 20
 * END
 *
 * EACH: numbers DO |item, idx|
 *   LOG: {{item}} at {{idx}}
 * END
 * ```
 *
 * **Notes**
 * - `$array`, `$element`, and `$index` are available inside the loop body.
 * - If multiple arrays are provided, the body runs for each element of each array.
 */
export const EACH_directive: StoryDirectiveFuncDef = {
  type: [EACH_TYPE, MAP_TYPE],
  func: async (node, ctx, pms, eaves) => {
    ctx.session.stack.push({});
    const results: SerialValue[] = [];
    for (let $sup = 0; $sup < pms.artifacts.length; $sup++) {
      const $array = castToArray(pms.artifacts[$sup]);
      ctx.set(STATE_ARRAY_KEY, $array, true);
      for (let $index = 0; $index < $array.length; $index++) {
        const $element = $array[$index];
        ctx.set(STATE_INDEX_KEY, $index, true);
        ctx.set(STATE_ELEMENT_KEY, $element, true);
        if (eaves[0]) ctx.set(eaves[0], $element, true);
        if (eaves[1]) ctx.set(eaves[1], $index, true);
        const result = await executeNode(wrapKids(node.kids), ctx);
        results.push(result ?? null);
      }
    }
    ctx.session.stack.pop();
    return results;
  },
};
