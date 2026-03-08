import { castToBoolean, castToNumber, castToString } from "../../lib/EvalCasting";
import { isBlank } from "../../lib/TextHelpers";
import { A, Method, eq, isP } from "./FunctionHelpers";

export const unifiedFunctions: Record<string, Method> = {
  /**
   * Returns true if the value is blank (empty string, empty array, empty object, zero, null, or undefined).
   * @name isBlank
   * @param v Value.
   * @returns True if the value is blank (empty string, empty array, empty object, zero, null, or undefined).
   * @example isBlank("") //=> true
   */
  isBlank: (v: unknown) => {
    return isBlank(v);
  },
  /**
   * Returns true if the value is present (not blank).
   * @name isPresent
   * @param v Value.
   * @returns True if the value is present (not blank).
   * @example isPresent("hi") //=> true
   */
  isPresent: (v: unknown) => {
    return !isBlank(v);
  },
  /**
   * Converts the value to a number.
   * @name toNumber
   * @param v Value.
   * @returns Converted value.
   * @example toNumber("42") //=> 42
   */
  toNumber: (v: unknown) => {
    return castToNumber(v);
  },
  /**
   * Converts the value to a string.
   * @name toString
   * @param v Value.
   * @returns Converted value.
   * @example toString(42) //=> "42"
   */
  toString: (v: unknown) => {
    return castToString(v);
  },
  /**
   * Converts the value to a boolean.
   * @name toBoolean
   * @param v Value.
   * @returns Converted value.
   * @example toBoolean("true") //=> true
   */
  toBoolean: (v: unknown) => {
    return castToBoolean(v);
  },
  /**
   * Returns the length of a string or array, or false if unsupported.
   * @name getLength
   * @param value Value.
   * @returns The length of a string or array, or false if unsupported.
   * @example getLength([1,2,3]) //=> 3
   */
  getLength: (value: unknown) => {
    const size = getSequenceLength(value);
    return size ?? false;
  },
  /**
   * Returns true if the value contains the search value.
   * @name doesContain
   * @param value Value.
   * @param search Search value.
   * @returns True if the value contains the search value.
   * @example doesContain("hello", "ell") //=> true
   */
  doesContain: (value: unknown, search: unknown) => {
    return includesValue(value, search);
  },
  /**
   * Returns true if the value includes the search value.
   * @name doesInclude
   * @param value Value.
   * @param search Search value.
   * @returns True if the value includes the search value.
   * @example doesInclude([1,2,3], 2) //=> true
   */
  doesInclude: (value: unknown, search: unknown) => {
    return includesValue(value, search);
  },
  /**
   * Returns true if the value has the search value.
   * @name doesHave
   * @param value Value.
   * @param search Search value.
   * @returns True if the value has the search value.
   * @example doesHave("hello", "lo") //=> true
   */
  doesHave: (value: unknown, search: unknown) => {
    return includesValue(value, search);
  },
};

function getSequenceLength(value: unknown): number | null {
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) return value.length;
  return null;
}

function includesValue(value: unknown, search: unknown): boolean {
  if (typeof value === "string") {
    if (typeof search !== "string") return false;
    return value.includes(search);
  }
  if (Array.isArray(value)) {
    return value.some((item) => matchesEntry(item, search));
  }
  return false;
}

function matchesEntry(entry: unknown, search: unknown): boolean {
  if (Array.isArray(entry) && Array.isArray(search)) {
    return eq(entry as A, search as A);
  }
  if (isP(entry) && isP(search)) {
    return eq(entry as A, search as A);
  }
  return false;
}
