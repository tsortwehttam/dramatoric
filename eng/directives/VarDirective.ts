import { StoryDirectiveFuncDef, VAR_TYPE } from "../Helpers";
import { trimTokenSpaces, type LexerToken, tokenize, tokensToScalarValue } from "../Lexer";
import { type SerialValue } from "../../lib/CoreTypings";

/**
 * ## VAR
 *
 * **Summary**
 * Return string content for assignment-style variable binding.
 *
 * **Syntax**
 * ```dramatoric
 * foo = VAR: Some text
 * foo = VAR: 5
 * foo = VAR: [a, b, c]
 * foo = VAR: DO
 *   multi-line text
 * END
 * ```
 *
 * **Notes**
 * - `VAR:` is intended for `name = VAR:` assignment form.
 * - It parses literal values like numbers, booleans, null, and arrays.
 * - It does not evaluate expressions or render `{{...}}` templates.
 * - Use quotes when you want a string that looks like another literal, e.g. `foo = VAR: "5"`.
 * - Use `SET:` when you want expression evaluation.
 */
export const VAR_directive: StoryDirectiveFuncDef = {
  type: [VAR_TYPE],
  func: async (node) => {
    const source = readLiteralSource(node);
    return [parseLiteralValue(source)];
  },
};

function readLiteralSource(node: { args: string; kids: { type: string; args: string }[] }) {
  if (node.kids.length < 1) {
    return node.args.trim();
  }
  return node.kids
    .filter((kid) => kid.type === "TEXT")
    .map((kid) => kid.args)
    .join("\n")
    .trim();
}

function parseLiteralValue(source: string): SerialValue {
  const trimmed = source.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return parseArrayLiteral(trimmed);
  }
  return tokensToScalarValue(tokenize(trimmed));
}

function parseArrayLiteral(source: string): SerialValue[] | string {
  const tokens = trimTokenSpaces(tokenize(source));
  if (tokens.length < 2) {
    return source;
  }
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  if (first?.type !== "PCT" || first.value !== "[" || last?.type !== "PCT" || last.value !== "]") {
    return source;
  }
  const values: string[] = [];
  let group: LexerToken[] = [];
  for (let i = 1; i < tokens.length - 1; i++) {
    const token = tokens[i];
    if (token.type === "PCT" && token.value === ",") {
      values.push(tokensToSource(group));
      group = [];
      continue;
    }
    group.push(token);
  }
  values.push(tokensToSource(group));
  return values.map((value) => parseLiteralValue(value));
}

function tokensToSource(tokens: LexerToken[]): string {
  return trimTokenSpaces(tokens)
    .map((token) => (token.type === "QUO" ? JSON.stringify(token.value) : token.value))
    .join("")
    .trim();
}
