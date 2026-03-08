import { SerialValue } from "../../lib/CoreTypings";
import { castToArray, castToBoolean, castToNumber } from "../../lib/EvalCasting";
import { isBlank } from "../../lib/TextHelpers";
import { StoryEventContext, StoryOperatorFunc, WellNode } from "../Helpers";

export const OPS: Record<string, StoryOperatorFunc> = {
  /**
   * ## INCR
   *
   * **Summary**
   * Increase one or more numeric variables.
   *
   * **Syntax**
   * ```dramatoric
   * INCR: key
   * INCR: key amount
   * INCR: key amount; otherKey otherAmount
   * ```
   *
   * **Examples**
   * ```dramatoric
   * INCR: steps
   * ```
   *
   * ```dramatoric
   * INCR: health 0.5
   * INCR: stamina 1; focus 0.25
   * ```
   *
   * **Notes**
   * - Missing amounts default to `+1`.
   * - Values are treated as numbers.
   */
  INCR: (node: WellNode, ctx: StoryEventContext, pairs: Record<string, SerialValue>) => {
    const out: SerialValue[] = [];
    for (const key in pairs) {
      const existing = castToNumber(ctx.get(key));
      const delta = isBlank(pairs[key]) ? 1 : castToNumber(pairs[key]);
      const updated = existing + delta;
      ctx.set(key, updated);
      out.push(updated);
    }
    return out;
  },
  /**
   * ## DECR
   *
   * **Summary**
   * Decrease one or more numeric variables.
   *
   * **Syntax**
   * ```dramatoric
   * DECR: key
   * DECR: key amount
   * DECR: key amount; otherKey otherAmount
   * ```
   *
   * **Examples**
   * ```dramatoric
   * DECR: health
   * ```
   *
   * ```dramatoric
   * DECR: stamina 0.5
   * DECR: focus 1; patience 0.25
   * ```
   *
   * **Notes**
   * - Missing amounts default to `-1`.
   * - Values are treated as numbers.
   */
  DECR: (node: WellNode, ctx: StoryEventContext, pairs: Record<string, SerialValue>) => {
    const out: SerialValue[] = [];
    for (const key in pairs) {
      const existing = castToNumber(ctx.get(key));
      const delta = isBlank(pairs[key]) ? -1 : -castToNumber(pairs[key]);
      const value = existing + delta;
      out.push(value);
      ctx.set(key, existing + delta);
    }
    return out;
  },
  /**
   * ## TOGGLE
   *
   * **Summary**
   * Flip one or more boolean variables.
   *
   * **Syntax**
   * ```dramatoric
   * TOGGLE: key
   * TOGGLE: key; otherKey
   * ```
   *
   * **Examples**
   * ```dramatoric
   * TOGGLE: doorsLocked
   * TOGGLE: lightsOn; alarmArmed
   * ```
   *
   * **Notes**
   * - Values are treated as booleans and then inverted.
   */
  TOGGLE: (node: WellNode, ctx: StoryEventContext, pairs: Record<string, SerialValue>) => {
    const out: SerialValue[] = [];
    for (const key in pairs) {
      const existing = castToBoolean(ctx.get(key));
      out.push(existing);
      ctx.set(key, existing ? false : true);
    }
    return out;
  },
  /**
   * ## PUSH
   *
   * **Summary**
   * Append values to one or more arrays.
   *
   * **Syntax**
   * ```dramatoric
   * PUSH: key value
   * PUSH: key value; otherKey otherValue
   * ```
   *
   * **Examples**
   * ```dramatoric
   * PUSH: logEvents "value"
   * ```
   *
   * ```dramatoric
   * PUSH: breadcrumbs {{sceneId}}; alerts "danger"
   * ```
   *
   * **Notes**
   * - Non-array values are treated as empty arrays before appending.
   */
  PUSH: (node: WellNode, ctx: StoryEventContext, pairs: Record<string, SerialValue>) => {
    const out: SerialValue[] = [];
    for (const key in pairs) {
      const existing = castToArray(ctx.get(key));
      const value = pairs[key];
      out.push(value);
      existing.push(value);
      ctx.set(key, existing);
    }
    return out;
  },
  /**
   * ## POP
   *
   * **Summary**
   * Remove and return the last element from one or more arrays.
   *
   * **Syntax**
   * ```dramatoric
   * POP: key
   * POP: key; otherKey
   * ```
   *
   * **Examples**
   * ```dramatoric
   * POP: logEvents
   * POP: logEvents; alerts
   * ```
   *
   * **Notes**
   * - Non-array values are treated as empty arrays.
   * - Popping an empty array returns nothing.
   */
  POP: (node: WellNode, ctx: StoryEventContext, pairs: Record<string, SerialValue>) => {
    const out: SerialValue[] = [];
    for (const key in pairs) {
      const existing = castToArray(ctx.get(key));
      out.push(existing.pop());
      ctx.set(key, existing);
    }
    return out;
  },
  /**
   * ## DEFAULT
   *
   * **Summary**
   * Set a variable only if it is currently unset.
   *
   * **Syntax**
   * ```dramatoric
   * DEFAULT: key value
   * DEFAULT: key value; otherKey otherValue
   * ```
   *
   * **Examples**
   * ```dramatoric
   * DEFAULT: hunger 0
   * DEFAULT: mood "calm"; retries 0
   * ```
   *
   * **Notes**
   * - Existing values are preserved.
   */
  DEFAULT: (node: WellNode, ctx: StoryEventContext, pairs: Record<string, SerialValue>) => {
    const out: SerialValue[] = [];
    for (const key in pairs) {
      const value = pairs[key];
      const existing = ctx.get(key);
      if (existing === undefined) {
        out.push(value);
        ctx.set(key, value);
      } else {
        // Return out var but do not overwrite
        out.push(existing);
      }
    }
    return out;
  },
  /**
   * ## SHIFT
   *
   * **Summary**
   * Remove and return the first element from one or more arrays.
   *
   * **Syntax**
   * ```dramatoric
   * SHIFT: key
   * SHIFT: key; otherKey
   * ```
   *
   * **Examples**
   * ```dramatoric
   * SHIFT: queue
   * SHIFT: queue; stack
   * ```
   *
   * **Notes**
   * - Non-array values are treated as empty arrays.
   * - Shifting an empty array returns nothing.
   */
  SHIFT: (node: WellNode, ctx: StoryEventContext, pairs: Record<string, SerialValue>) => {
    const out: SerialValue[] = [];
    for (const key in pairs) {
      const existing = castToArray(ctx.get(key));
      out.push(existing.shift());
      ctx.set(key, existing);
    }
    return out;
  },
  /**
   * ## UNSHIFT
   *
   * **Summary**
   * Prepend values to one or more arrays.
   *
   * **Syntax**
   * ```dramatoric
   * UNSHIFT: key value
   * UNSHIFT: key value; otherKey otherValue
   * ```
   *
   * **Examples**
   * ```dramatoric
   * UNSHIFT: queue "value"
   * ```
   *
   * ```dramatoric
   * UNSHIFT: stack {{item}}; history "event"
   * ```
   *
   * **Notes**
   * - Non-array values are treated as empty arrays before prepending.
   */
  UNSHIFT: (node: WellNode, ctx: StoryEventContext, pairs: Record<string, SerialValue>) => {
    const out: SerialValue[] = [];
    for (const key in pairs) {
      const existing = castToArray(ctx.get(key));
      const value = pairs[key];
      out.push(value);
      existing.unshift(value);
      ctx.set(key, existing);
    }
    return out;
  },
  /**
   * ## SPLICE
   *
   * **Summary**
   * Remove one or more elements from an array starting at an index.
   *
   * **Syntax**
   * ```dramatoric
   * SPLICE: key index
   * SPLICE: key (startIndex, deleteCount)
   * ```
   *
   * **Examples**
   * ```dramatoric
   * SPLICE: items 2
   * ```
   *
   * ```dramatoric
   * SPLICE: items (2, 3)
   * ```
   *
   * **Notes**
   * - A single index removes one element.
   * - A tuple removes `deleteCount` elements starting at `startIndex`.
   */
  SPLICE: (node: WellNode, ctx: StoryEventContext, pairs: Record<string, SerialValue>) => {
    const out: SerialValue[] = [];
    for (const key in pairs) {
      const existing = castToArray(ctx.get(key));
      const param = pairs[key];
      let start = 0;
      let deleteCount = 1;
      if (Array.isArray(param)) {
        start = castToNumber(param[0]);
        deleteCount = param.length > 1 ? castToNumber(param[1]) : 1;
      } else {
        start = castToNumber(param);
      }
      const removed = existing.splice(start, deleteCount);
      out.push(removed);
      ctx.set(key, existing);
    }
    return out;
  },
};
