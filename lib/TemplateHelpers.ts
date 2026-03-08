import { SerialValue } from "./CoreTypings";
import { castToString } from "./EvalCasting";

const HANDLEBARS = /\{\{\s*([\s\S]+?)\s*\}\}/g;

export function renderHandlebarsTemplate(text: string, resolver: (expr: string) => SerialValue): string {
  if (!HANDLEBARS.test(text)) {
    HANDLEBARS.lastIndex = 0;
    return text;
  }
  HANDLEBARS.lastIndex = 0;
  let out = "";
  let loc = 0;
  let match: RegExpExecArray | null;
  while ((match = HANDLEBARS.exec(text)) !== null) {
    const start = match.index ?? 0;
    out += text.slice(loc, start);
    const value = resolver(match[1].trim());
    out += castToString(value);
    loc = start + match[0].length;
  }
  out += text.slice(loc);
  HANDLEBARS.lastIndex = 0;
  return out;
}
