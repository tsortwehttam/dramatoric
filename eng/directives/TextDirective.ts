import { StoryDirectiveFuncDef, TEXTVAR_TYPE } from "../Helpers";

/**
 * ## TEXT
 *
 * **Summary**
 * Return literal text content for assignment-style variable binding.
 *
 * **Syntax**
 * ```dramatoric
 * foo = TEXT: 5
 * foo = TEXT: {{name}}
 * foo = TEXT: DO
 *   multi-line text
 * END
 * ```
 *
 * **Notes**
 * - `TEXT:` is intended for `name = TEXT:` assignment form.
 * - It always returns a string value.
 * - It does not evaluate expressions or render `{{...}}` templates.
 */
export const TEXT_directive: StoryDirectiveFuncDef = {
  type: [TEXTVAR_TYPE],
  func: async (node) => {
    return [readLiteralText(node)];
  },
};

function readLiteralText(node: { args: string; kids: { type: string; args: string }[] }) {
  if (node.kids.length < 1) {
    return node.args.trim();
  }
  return node.kids
    .filter((kid) => kid.type === "TEXT")
    .map((kid) => kid.args)
    .join("\n")
    .trim();
}
