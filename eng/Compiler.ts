import { dump } from "js-yaml";
import * as peggy from "peggy";
import { ErrorBase, SerialValue } from "../lib/CoreTypings";
import { walkTree } from "../lib/GenericNodeHelpers";
import { extractFrontmatter, safeJsonParse, safeYamlParse } from "../lib/JSONAndYAMLHelpers";
import { createPRNG } from "../lib/RandHelpers";
import { isPresent } from "../lib/TextHelpers";
import { mutativeMerge } from "../lib/ValueHelpers";
import { createLoadedRunner } from "./Evaluator";
import { buildCompileWorldExprFunctions } from "./functions/WorldExprFunctions";
import {
  dumpNode,
  EVENT_KEY,
  EVENT_HANDLERS,
  INPUT_KEY,
  INPUT_TYPE,
  isMain,
  LLM_SCHEMA_FALLBACK_KEY,
  marshallParams,
  ON_TYPE,
  PARAMS_KEY,
  PRELUDE_TYPE,
  ROOT_TYPE,
  STATE_ARRAY_KEY,
  STATE_ELEMENT_KEY,
  STATE_INDEX_KEY,
  STATE_ITERATION_KEY,
  StoryEventType,
  SET_TYPE,
  StoryCartridge,
  StoryMeta,
  StorySources,
  TEXT_TYPE,
  TEXTVAR_TYPE,
  VAR_TYPE,
  WELL_EXT,
  WellNode,
} from "./Helpers";
import { looksLikeScriptExpression, tokenize, tokensToKVP } from "./Lexer";

export const WELLTALE_GRAMMAR = `
// Dramatoric DSL Grammar (colon-terminated headers)

{{
  function unescapeText(text) {
    return (text || "").replace(/\\:/g, ":");
  }

  function node(type, args, kids, vars, eave) {
    return {
      type: type,
      args: (args || "").trim(),
      kids: kids || [],
      vars: vars || [],
      eave: eave || ""
    };
  }

  function textNode(text) {
    const t = unescapeText(text);
    const trimmed = t.trim();
    return trimmed ? node("TEXT", t, [], []) : null;
  }

  function vars(list) {
    return list.map((v, i) => ({
      name: v.endsWith("[]") ? v.slice(0, -2) : v,
      type: (i === list.length - 1 && v.endsWith("[]")) ? "arr" : "val"
    }));
  }
}}

Document
  = stanzas:(_ Stanza)* _ { return node("ROOT", "", stanzas.map(s => s[1]), []); }

Stanza
  = Assignment
  / Directive

Assignment
  = v:VarList ws "=" ws h:Header ws a:Args? b:Block {
      return { ...node(h, a || "", b.kids, [], b.eave), vars: vars(v) };
    }
  / v:VarList ws "=" ws h:Header ws a:Args? ImplicitStart lines:ImplicitBlock {
      return { ...node(h, a || "", lines, []), vars: vars(v) };
    }
  / v:VarList ws "=" ws h:Header ws a:Args? (NL / !.) {
      return { ...node(h, a || "", [], []), vars: vars(v) };
    }

Directive
  = h:Header ws a:Args? b:Block {
      return node(h, a || "", b.kids, [], b.eave);
    }
  / h:Header ws a:Args? ImplicitStart lines:ImplicitBlock {
      return node(h, a || "", lines, []);
    }
  / h:Header ws a:Args? (NL / !.) {
      return node(h, a || "", [], []);
    }

Header
  = h:$(HeaderFirst HeaderTail*) ":" { return h.trimEnd(); }

HeaderFirst
  = TemplateExpr
  / [^ \\t\\n:a-z\\-]

HeaderTail
  = TemplateExpr
  / [^\\n:a-z]

TemplateExpr
  = "{{" (!"}}". )* "}}"

VarList
  = h:VarName t:(ws "," ws v:VarName { return v; })* { return [h, ...t]; }

VarName
  = n:$([a-zA-Z_$][a-zA-Z0-9_]*) a:"[]"? { return n + (a || ""); }

Args
  = a:$(!DO !NL .)+ { return a.trim(); }

Block
  = ws e:DO kids:(_ BlockContent)* _ END { return { kids: kids.map(k => k[1]).filter(Boolean), eave: e }; }

ImplicitStart
  = NL !Terminator

ImplicitBlock
  = lines:ImplicitLine+ { return lines.filter(Boolean); }

ImplicitLine
  = !Terminator t:TextLine { return t; }

Terminator
  = BlankLine
  / HeaderStart
  / &([ \\t]* END)

BlockContent
  = Stanza
  / t:TextLine { return t; }

TextLine
  = !END c:$((!NL .)+) NL {
      const tn = textNode(c);
      return tn;
    }

BlankLine = ws NL
HeaderStart = &([ \\t]* HeaderFirst HeaderTail* ":")

DO = ("DO" / "{") ws e:Eave? ws NL { return e || ""; }
Eave = "|" e:$([^|\\n]*) "|" { return e.trim(); }
END = ("END" / "}") ws (NL / !.)

NL = "\\n"
ws = [ \\t]*
_ = [ \\t\\n]*
`;

let parser: peggy.Parser | null = null;

function getParser(): peggy.Parser {
  if (!parser) {
    parser = peggy.generate(WELLTALE_GRAMMAR);
  }
  return parser;
}

// Note that this *only* parses a well-formed document. In reality we do some pre-processing
// of the string to allow authors some syntactic sugar and other things like inline //-comments
// and so forth. Please see StoryCompiler.ts `parseDSL` to understand that part
export function parseWellFormedDSL(source: string): { node: WellNode } | { errors: ErrorBase[] } {
  try {
    const node = getParser().parse(source);
    return { node };
  } catch (error) {
    console.warn(error);
    return { errors: [{ type: "syntax-error", name: "" }] };
  }
}

export function parseDSL(raw: string) {
  // Extract front matter and remove from the source: PEG parser doesn't know about front matter
  const { content, frontmatter: meta } = extractFrontmatter(raw);

  // Do other transformations to simplify and normalize before handing off to the PEG parse
  const lines = stripBlockComments(content)
    .trim()
    .split("\n")
    // Remove all single-line comments
    .map((line) => {
      const idx = line.indexOf(COMMENT_PREFIX);
      if (idx === -1) return line;
      return line.slice(0, idx);
    });

  const importantFinalNewline = "\n";
  const result = parseWellFormedDSL(lines.join("\n") + importantFinalNewline);
  if ("node" in result) {
    return { root: result.node, meta };
  }
  return result;
}

export const COMMENT_PREFIX = "//";

function stripBlockComments(input: string): string {
  let out = "";
  let i = 0;
  let inBlock = false;

  while (i < input.length) {
    const ch = input[i];
    const next = input[i + 1];

    if (!inBlock && ch === "/" && next === "*") {
      inBlock = true;
      out += "  ";
      i += 2;
      continue;
    }

    if (inBlock && ch === "*" && next === "/") {
      inBlock = false;
      out += "  ";
      i += 2;
      continue;
    }

    if (inBlock) {
      out += ch === "\n" ? "\n" : " ";
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

export function extractBaseMeta(cartridge: StoryCartridge) {
  const meta: StoryMeta = {
    voices: {},
    pronunciations: {},
    scripts: {},
  };

  const jsons: unknown[] = Object.keys(cartridge)
    .filter((k) => k.endsWith(".json"))
    .map((key) => safeJsonParse(cartridge[key].toString()))
    .filter(isPresent) as unknown[];
  const yamls: unknown[] = Object.keys(cartridge)
    .filter((k) => k.endsWith(".yml") || k.endsWith(".yaml"))
    .map((key) => safeYamlParse(cartridge[key].toString()))
    .filter(isPresent) as unknown[];
  [...jsons, ...yamls].forEach((data) => {
    mutativeMerge(meta, data);
  });

  Object.keys(cartridge)
    .filter((k) => k.endsWith(".ts") || k.endsWith(".js"))
    .forEach((key) => {
      const src = cartridge[key];
      const parts = key.split("/");
      let cur = meta.scripts;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!cur[part] || typeof cur[part] !== "object") {
          cur[part] = {};
        }
        cur = cur[part];
      }
      const last = parts[parts.length - 1];
      cur[last] = src.toString();
    });

  return meta;
}

export function compileCartridge(cartridge: StoryCartridge, errors: ErrorBase[] = []): StorySources {
  console.info("[compiler] cartridge", Object.keys(cartridge));
  const root: WellNode = {
    type: ROOT_TYPE,
    kids: [],
    args: "",
    vars: [],
    eave: "",
  };
  const meta = extractBaseMeta(cartridge);
  const wells = Object.keys(cartridge).filter((k) => k.endsWith(WELL_EXT));
  const mains = wells.filter(isMain);
  const rest = wells.filter((k) => !isMain(k));
  const keys = [...mains, ...rest];
  for (let i = 0; i < keys.length; i++) {
    const path = keys[i];
    console.info("[compiler] parse", path);
    const raw = cartridge[path].toString("utf-8");
    const parsed = parseDSL(raw);
    if ("root" in parsed) {
      mutativeMerge(meta, parsed.meta);
      root.kids.push(...parsed.root.kids);
    } else {
      errors.push(...parsed.errors);
    }
  }

  // Hoist non-wrapped, top-level nodes into implicit PRELUDE handler
  const wrap: WellNode = {
    type: PRELUDE_TYPE,
    args: "",
    kids: [],
    vars: [],
    eave: "",
  };
  const kids = root.kids.splice(0);
  kids.forEach((node) => {
    // Convert "INPUT: DO" as sugar for "ON: $input DO"
    if (node.type === INPUT_TYPE) {
      node.type = ON_TYPE;
      node.args = `${INPUT_KEY};${node.args}`;
    }
    if (!EVENT_HANDLERS.includes(node.type)) {
      wrap.kids.push(node);
    } else {
      root.kids.push(node);
    }
  });
  root.kids.push(wrap);

  walkTree(root, (node) => {
    if (node.type === TEXT_TYPE && node.vars.length > 0) {
      node.type = TEXTVAR_TYPE;
    }
  });

  // Quick static analysis of script-like expressions
  const runner = createLoadedRunner(createPRNG("compile"), {}, buildCompileWorldExprFunctions());
  const vars = collectCompileVars(root, meta);
  walkTree(root, (node) => {
    const suspicious = findSuspiciousImplicitBodyLine(node);
    if (suspicious) {
      errors.push({
        type: "warning-implicit-body-stanza",
        name: node.type,
        note: `Suspicious body line parsed as text: ${suspicious}. Did you mean to add a blank line or use DO ... END?`,
      });
    }
    if (node.type === VAR_TYPE || node.type === TEXTVAR_TYPE) {
      return;
    }
    const pms = marshallParams(node.args, () => "");
    pms.groups.forEach((group, idx) => {
      if (looksLikeScriptExpression(group)) {
        const clause = pms.clauses[idx];
        errors.push(...runner.validate(clause, vars));
      }
    });
  });

  console.info("[compiler] compiled", meta, "\n" + dumpNode(root));
  if (errors.length > 0) {
    console.info("[compiler] errors", errors);
  }
  return { root, meta, errs: errors };
}

const SUSPICIOUS_STANZA_LINE =
  /^([A-Za-z_$][A-Za-z0-9_$]*(?:\[\])?(?:\s*,\s*[A-Za-z_$][A-Za-z0-9_$]*(?:\[\])?)*)\s*=\s*[A-Z][A-Z0-9 _-]*:|^[A-Z][A-Z0-9 _-]*:/;

function findSuspiciousImplicitBodyLine(node: WellNode): string | null {
  if (node.kids.length < 1) {
    return null;
  }
  if (!node.kids.every((kid) => kid.type === TEXT_TYPE)) {
    return null;
  }
  for (const kid of node.kids) {
    const line = kid.args.trim();
    if (SUSPICIOUS_STANZA_LINE.test(line)) {
      return line;
    }
  }
  return null;
}

function collectCompileVars(root: WellNode, meta: StoryMeta): Record<string, SerialValue> {
  const vars: Record<string, SerialValue> = {
    $turns: true,
    $first: true,
    $time: true,
    [EVENT_KEY]: true,
    [INPUT_KEY]: true,
    [PARAMS_KEY]: true,
    params: true,
    [STATE_ARRAY_KEY]: true,
    [STATE_INDEX_KEY]: true,
    [STATE_ELEMENT_KEY]: true,
    [STATE_ITERATION_KEY]: true,
    [LLM_SCHEMA_FALLBACK_KEY]: true,
  };
  Object.values(StoryEventType).forEach((key) => {
    vars[key] = true;
  });
  Object.keys(meta).forEach((key) => {
    vars[key] = true;
  });
  walkTree(root, (node) => {
    node.vars.forEach((v) => {
      vars[v.name] = true;
    });
    if (node.type === SET_TYPE) {
      const pairs = tokensToKVP(tokenize(node.args));
      Object.keys(pairs).forEach((key) => {
        vars[key] = true;
      });
    }
  });
  return vars;
}

export function serializeNode(node: WellNode, indent: string = ""): string {
  const lines: string[] = [];
  if (node.type === TEXT_TYPE) {
    lines.push(indent + node.args);
    return lines.join("\n");
  }
  const rawType = node.type === TEXTVAR_TYPE ? "TEXT" : node.type;
  const varsPrefix =
    node.vars.length > 0 ? node.vars.map((v) => v.name + (v.type === "arr" ? "[]" : "")).join(", ") + " = " : "";
  const hasKids = node.kids.length > 0;
  const eaveStr = node.eave ? ` |${node.eave}|` : "";
  const allKidsAreText = hasKids && node.kids.every((k) => k.type === TEXT_TYPE);
  if (hasKids && allKidsAreText) {
    const header = `${indent}${varsPrefix}${rawType}:${node.args ? " " + node.args : ""}`;
    lines.push(header);
    for (const kid of node.kids) {
      lines.push(serializeNode(kid, indent));
    }
  } else if (hasKids) {
    const header = `${indent}${varsPrefix}${rawType}:${node.args ? " " + node.args : ""} DO${eaveStr}`;
    lines.push(header);
    for (const kid of node.kids) {
      lines.push(serializeNode(kid, indent + "  "));
    }
    lines.push(indent + "END");
  } else {
    const header = `${indent}${varsPrefix}${rawType}:${node.args ? " " + node.args : ""}`;
    lines.push(header);
  }
  return lines.join("\n");
}

function metaHasContent(meta: StoryMeta): boolean {
  const hasVoices = Object.keys(meta.voices).length > 0;
  const hasPronunciations = Object.keys(meta.pronunciations).length > 0;
  const hasScripts = Object.keys(meta.scripts).length > 0;
  const hasOther = Object.keys(meta).some((k) => !["voices", "pronunciations", "scripts"].includes(k));
  return hasVoices || hasPronunciations || hasScripts || hasOther;
}

export function serializeSources(sources: StorySources): string {
  const parts: string[] = [];
  if (metaHasContent(sources.meta)) {
    const metaClean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sources.meta)) {
      if (k === "voices" && Object.keys(v as object).length === 0) continue;
      if (k === "pronunciations" && Object.keys(v as object).length === 0) continue;
      if (k === "scripts" && Object.keys(v as object).length === 0) continue;
      metaClean[k] = v;
    }
    if (Object.keys(metaClean).length > 0) {
      parts.push("---");
      parts.push(dump(metaClean, { indent: 2, lineWidth: -1 }).trim());
      parts.push("---");
      parts.push("");
    }
  }
  const root = sources.root;
  const kids = root.kids;
  for (const node of kids) {
    if (node.type === PRELUDE_TYPE && node.args === "") {
      for (const inner of node.kids) {
        parts.push(serializeNode(inner));
        parts.push("");
      }
    } else {
      parts.push(serializeNode(node));
      parts.push("");
    }
  }
  return parts.join("\n").trim() + "\n";
}
