import { asyncMap, parallel } from "../lib/AsyncHelpers";
import { JsonSchema, SerialValue } from "../lib/CoreTypings";
import { allTruthy, castToString, isVarPath, safeGet } from "../lib/EvalCasting";
import { isValidUrl } from "../lib/HTTPHelpers";
import { safeJsonOrYamlParse, safeJsonParse, safeYamlParse } from "../lib/JSONAndYAMLHelpers";
import { LLMInstruction, LLMInstructionRole } from "../lib/LLMTypes";
import { renderHandlebarsTemplate } from "../lib/TemplateHelpers";
import { isBlank, parseLooseKeyValues } from "../lib/TextHelpers";
import {
  CASE_TYPE,
  contextReadable,
  ELSE_TYPE,
  extractEmbeddedSegments,
  IF_TYPE,
  LLM_SUBCOMMAND_CLASSIFY,
  LLM_SUBCOMMAND_GENERATE,
  LLM_SUBCOMMAND_NORMALIZE,
  LLM_SUBCOMMAND_PARSE,
  LLMYieldFunc,
  marshallParams,
  marshallTokensToValue,
  ON_TYPE,
  ONCE_TYPE,
  onlyNonSpaceTokens,
  pickDDV,
  PROMPT_SYSTEM_TYPE,
  PROMPT_USER_TYPE,
  RawInputShape,
  reifyEvent,
  SCHEMA_TYPE,
  splitArgTokens,
  StoryEvent,
  StoryEventContext,
  StoryEventType,
  TEXT_TYPE,
  tokensToArgText,
  WellNode,
  WellVarBinding,
  WHEN_TYPE,
} from "./Helpers";
import { EAVE_DELIM, KVP_DELIM, tokenize, tokensToKeyGroupPairs } from "./Lexer";
import { createLLMYieldIfFunc, rawInputToPartialMessage } from "./Processor";

export const executeNode = async (node: WellNode, ctx: StoryEventContext): Promise<SerialValue[]> => {
  if (++ctx.calls > ctx.session.options.maxCallsPerEvent) {
    console.warn("Exceeded max calls per event");
    ctx.halted = true;
    return [];
  }
  ctx.elapsed = Date.now() - ctx.started;
  if (ctx.elapsed > ctx.session.options.maxTimePerStep) {
    console.warn("Exceeded max time per step");
    ctx.halted = true;
    return [];
  }

  // Render the directive type to support interpolated headers
  const renderedType = renderHandlebarsAndDDV(node.type, ctx);
  const upperType = renderedType.toUpperCase();

  const directive = ctx.directives.find((a) => a.type.includes(upperType) || a.type.length < 1);

  if (directive) {
    // Create a new node with the rendered type for action execution
    const nodeToExec = { ...node, type: renderedType };
    const eaves = marshallEaves(node.eave, ctx);
    const renderedArgs = renderHandlebarsAndDDV(node.args, ctx).trim();
    const pms = marshallParams(renderedArgs, ctx.evaluate);

    console.info("[engine] ~>", renderedType);

    const results = (await directive.func(nodeToExec, ctx, pms, eaves)) ?? null;

    // Handle automatic variable assignment
    if (results && node.vars.length > 0 && results.length > 0) {
      node.vars.forEach((v: WellVarBinding, index: number) => {
        if (v.type === "arr") {
          ctx.set(v.name, results.slice(index));
        } else if (index < results.length) {
          ctx.set(v.name, results[index]);
        }
      });
    }

    return results ?? [];
  } else {
    console.warn(`Missing directive "${renderedType}"`);
  }

  return [];
};

export async function marshallText(
  node: WellNode,
  ctx: StoryEventContext,
  delim: string = "\n",
  textPath: number[] = [],
): Promise<string> {
  let targetKids = node.kids;
  if (node.type === IF_TYPE || node.type === WHEN_TYPE || node.type === ON_TYPE) {
    const ok = await meetsAllConditions(renderHandlebarsAndDDV(node.args, ctx), ctx, createLLMYieldIfFunc(ctx));
    const { thenKids, elseKids } = splitConditionalKids(node.kids);
    targetKids = ok ? thenKids : elseKids;
    if (targetKids.length < 1) {
      return "";
    }
  } else if (node.type === ONCE_TYPE) {
    const key = ctx.path.join(".") + ":" + textPath.join(".");
    if (ctx.session.once[key]) {
      return "";
    }
    ctx.session.once[key] = true;
  } else if (node.type === CASE_TYPE) {
    targetKids = await selectCaseKids(node, ctx, createLLMYieldIfFunc(ctx));
    if (targetKids.length < 1) {
      return "";
    }
  }
  const kids = await asyncMap(targetKids, async (kid: WellNode, i: number) =>
    marshallText(kid, ctx, delim, [...textPath, i]),
  );
  const prefix = node.type === TEXT_TYPE ? node.args : "";
  return prefix + kids.join(delim);
}

export function renderHandlebarsAndDDV(text: string, ctx: StoryEventContext): string {
  if (text.length < 3 || isBlank(text)) {
    return text;
  }
  const scope = contextReadable(ctx);
  return renderHandlebarsTemplate(text, (expr) => renderHandlebarsValue(expr, ctx, scope));
}

type DdvMode = "random" | "cycle" | "bag";

function renderHandlebarsValue(expr: string, ctx: StoryEventContext, scope: Record<string, SerialValue>): SerialValue {
  const trimmed = expr.trim();
  if (!trimmed) {
    return "";
  }
  const modePrefix = readDdvModePrefix(trimmed);
  const mode = modePrefix ? modePrefix.mode : null;
  const core = modePrefix ? modePrefix.core : trimmed;
  const structured = parseStructuredValue(core);
  const structuredDdv = resolveStructuredDdv(structured, mode);
  if (structuredDdv) {
    return pickDdvValue(structuredDdv.values, ctx, structuredDdv.mode);
  }
  if (mode) {
    const pipeValues = splitPipeValues(core);
    return pickDdvValue(pipeValues, ctx, mode);
  }
  if (structured !== null) {
    return structured;
  }
  const pipes = splitPipeValuesOrNull(core);
  if (pipes) {
    return pickDdvValue(pipes, ctx, "random");
  }
  if (isVarPath(core)) {
    return safeGet(scope, core);
  }
  return ctx.evaluate(core, {}, {});
}

function readDdvModePrefix(s: string): { mode: DdvMode; core: string } | null {
  if (s.startsWith("^")) {
    return { mode: "cycle", core: s.slice(1).trim() };
  }
  if (s.startsWith("~")) {
    return { mode: "bag", core: s.slice(1).trim() };
  }
  return null;
}

function parseStructuredValue(text: string): SerialValue | null {
  if (!looksStructuredData(text)) {
    return null;
  }
  const json = safeJsonParse(text);
  if (json !== null) {
    return json;
  }
  const yaml = safeYamlParse(text);
  if (yaml === undefined) {
    return null;
  }
  return yaml ?? null;
}

function looksStructuredData(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith("---") || trimmed.startsWith("- ")) {
    return true;
  }
  if (trimmed.includes("\n")) {
    return /^\s*[-\w"'`]+\s*:\s+/m.test(trimmed);
  }
  return /^\s*[-\w"'`]+\s*:\s+/.test(trimmed);
}

function resolveStructuredDdv(
  value: SerialValue | null,
  prefixMode: DdvMode | null,
): { values: SerialValue[]; mode: DdvMode } | null {
  if (Array.isArray(value)) {
    return { values: value, mode: prefixMode ?? "random" };
  }
  if (isRecord(value)) {
    const rawValues = value.values ?? value.ddv ?? null;
    if (Array.isArray(rawValues)) {
      const mode = prefixMode ?? readDdvModeValue(value.mode ?? value.ddvMode ?? null) ?? "random";
      return { values: rawValues, mode };
    }
  }
  return null;
}

function readDdvModeValue(value: SerialValue): DdvMode | null {
  const mode = castToString(value).toLowerCase().trim();
  if (mode === "cycle") return "cycle";
  if (mode === "bag") return "bag";
  if (mode === "random") return "random";
  return null;
}

function pickDdvValue(values: SerialValue[], ctx: StoryEventContext, mode: DdvMode): string {
  const vars = values.map((value) => castToString(value));
  return pickDDV(vars, ctx.session.ddv, ctx.rng, { mode });
}

function splitPipeValuesOrNull(text: string): string[] | null {
  const info = splitTopLevelPipes(text);
  if (!info) return null;
  if (info.hasDoublePipe) return null;
  return info.parts;
}

function splitPipeValues(text: string): string[] {
  const info = splitTopLevelPipes(text);
  if (!info || info.parts.length < 1) return [unescapePipeValue(text.trim())];
  return info.parts;
}

function splitTopLevelPipes(text: string): { parts: string[]; hasDoublePipe: boolean } | null {
  const trimmed = text.trim();
  if (!trimmed.includes("|")) {
    return null;
  }
  const parts: string[] = [];
  let current = "";
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escape = false;
  let hasDoublePipe = false;

  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i] ?? "";
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (!inDouble && !inBacktick && ch === "'") {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (!inSingle && !inBacktick && ch === '"') {
      inDouble = !inDouble;
      current += ch;
      continue;
    }
    if (!inSingle && !inDouble && ch === "`") {
      inBacktick = !inBacktick;
      current += ch;
      continue;
    }
    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === "(") depthParen += 1;
      if (ch === ")") depthParen = Math.max(0, depthParen - 1);
      if (ch === "[") depthBracket += 1;
      if (ch === "]") depthBracket = Math.max(0, depthBracket - 1);
      if (ch === "{") depthBrace += 1;
      if (ch === "}") depthBrace = Math.max(0, depthBrace - 1);
      if (ch === "|" && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
        const next = trimmed[i + 1] ?? "";
        if (next === "|") {
          hasDoublePipe = true;
          current += ch;
          continue;
        }
        parts.push(normalizePipeValue(current));
        current = "";
        continue;
      }
    }
    current += ch;
  }
  parts.push(normalizePipeValue(current));
  if (parts.length < 2) {
    return null;
  }
  return { parts, hasDoublePipe };
}

function normalizePipeValue(value: string): string {
  const trimmed = unescapePipeValue(value.trim());
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0] ?? "";
  const last = trimmed[trimmed.length - 1] ?? "";
  if ((first === '"' && last === '"') || (first === "'" && last === "'") || (first === "`" && last === "`")) {
    return trimmed.slice(1, -1).replace(/\\(.)/g, "$1");
  }
  return trimmed;
}

function unescapePipeValue(value: string): string {
  return value.replace(/\\([|\\])/g, "$1");
}

export async function evalAllClauses(
  clauses: string[],
  ctx: StoryEventContext,
  llm: LLMYieldFunc,
): Promise<SerialValue[]> {
  return asyncMap(clauses, async (clause) => {
    const expr = clause.trim();
    if (!expr) {
      return null;
    }
    const segs = extractEmbeddedSegments(expr);
    const hasPrompt = segs.some((s) => s.kind === "prompt");
    if (!hasPrompt) {
      return ctx.evaluate(expr, {}, {});
    }
    const hasCode = segs.some((s) => s.kind === "text");
    if (!hasCode) {
      const prompt = segs.map((s) => s.value).join("\n");
      return llm(prompt);
    }
    // Reduce-then-evaluate: resolve each <<>> to a value, substitute, then evaluate
    const resolved = await asyncMap(segs, async (seg) => {
      if (seg.kind === "text") return seg.value;
      const result = await llm(seg.value);
      return String(result);
    });
    return ctx.evaluate(resolved.join(" "), {}, {});
  });
}

// Shares tokenize/splitArgTokens/tokensToArgText with marshallParams; kept separate to avoid wasteful computation
export async function meetsAllConditions(text: string, ctx: StoryEventContext, llm: LLMYieldFunc): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  const tokens = tokenize(trimmed);
  const groups = splitArgTokens(tokens);
  if (groups.length < 1) {
    return false;
  }
  const clauses = groups.map((group) => tokensToArgText(group)).filter((expr) => !!expr);
  return allTruthy(await evalAllClauses(clauses, ctx, llm));
}

export async function readBody(node: WellNode, ctx: StoryEventContext) {
  return renderHandlebarsAndDDV(await marshallText(node, ctx), ctx).trim();
}

export function splitConditionalKids(kids: WellNode[]) {
  const thenKids: WellNode[] = [];
  const elseKids: WellNode[] = [];
  let seenElse = false;
  for (let i = 0; i < kids.length; i++) {
    const kid = kids[i];
    if (!seenElse && kid.type !== ELSE_TYPE) {
      thenKids.push(kid);
      continue;
    }
    if (!seenElse && kid.type === ELSE_TYPE) {
      seenElse = true;
      elseKids.push(...kid.kids);
      continue;
    }
    elseKids.push(kid);
  }
  return { thenKids, elseKids };
}

export function splitCaseKids(kids: WellNode[]) {
  const whenNodes: WellNode[] = [];
  let elseKids: WellNode[] = [];
  let seenElse = false;
  for (let i = 0; i < kids.length; i++) {
    const kid = kids[i];
    if (kid.type === WHEN_TYPE) {
      whenNodes.push(kid);
      continue;
    }
    if (!seenElse && kid.type === ELSE_TYPE) {
      seenElse = true;
      elseKids = kid.kids;
    }
  }
  return { whenNodes, elseKids };
}

export async function executeKids(
  kids: WellNode[],
  ctx: StoryEventContext,
  out: SerialValue[] = [],
  startFrom: number = 0,
) {
  let start = startFrom;
  if (ctx.resume.length > 0 && ctx.resume.length > ctx.path.length) {
    let ok = true;
    for (let i = 0; i < ctx.path.length; i++) {
      if (ctx.resume[i] !== ctx.path[i]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      start = Math.max(start, ctx.resume[ctx.path.length]);
    }
  }
  for (let i = start; i < kids.length; i++) {
    if (ctx.halted || ctx.exited) break;
    ctx.path.push(i);
    const results = await executeNode(kids[i], ctx);
    out.push(results);
    ctx.path.pop();
  }
  return out;
}

export function applySuspendCheckpoint(ctx: StoryEventContext): boolean {
  const handler = ctx.handler;
  const checkpoint = ctx.session.checkpoints[handler] ?? [];
  if (!pathEquals(checkpoint, ctx.path)) {
    ctx.session.checkpoints[handler] = [...ctx.path];
    ctx.halted = true;
    return true;
  }
  delete ctx.session.checkpoints[handler];
  ctx.resume = [];
  return false;
}

export async function selectCaseKids(node: WellNode, ctx: StoryEventContext, llm: LLMYieldFunc) {
  const caseArgs = renderHandlebarsAndDDV(node.args, ctx).trim();
  const { whenNodes, elseKids } = splitCaseKids(node.kids);
  if (caseArgs) {
    const value = ctx.evaluate(caseArgs, {}, {});
    for (let i = 0; i < whenNodes.length; i++) {
      const whenNode = whenNodes[i];
      const whenValue = ctx.evaluate(renderHandlebarsAndDDV(whenNode.args, ctx), {}, {});
      if (value === whenValue) {
        return whenNode.kids;
      }
    }
  } else {
    for (let i = 0; i < whenNodes.length; i++) {
      const whenNode = whenNodes[i];
      const whenArgs = renderHandlebarsAndDDV(whenNode.args, ctx).trim();
      if (await meetsAllConditions(whenArgs, ctx, llm)) {
        return whenNode.kids;
      }
    }
  }
  return elseKids;
}

export function isRecord(value: unknown): value is Record<string, SerialValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseSchemaBody(body: string, ctx: StoryEventContext) {
  if (isBlank(body)) {
    return {};
  }
  const parsed = safeJsonOrYamlParse(body);
  if (isRecord(parsed)) {
    return parsed;
  }
  try {
    const expr = parseSchemaExpressions(body, ctx);
    if (Object.keys(expr).length > 0) {
      return expr;
    }
  } catch (e) {
    console.warn(`Schema "${body}" won't parse; using heuristic`);
  }
  return parseLooseKeyValues(body);
}

export function parseSchemaExpressions(text: string, ctx: StoryEventContext) {
  const segments = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !!line);
  if (segments.length < 1) {
    return {};
  }
  const source = segments.join(` ${KVP_DELIM} `);
  const tokens = tokenize(source);
  if (tokens.length < 1) {
    return {};
  }
  const out: Record<string, SerialValue> = {};
  const kvp = tokensToKeyGroupPairs(tokens);
  for (const key in kvp) {
    // Note that keys are ALWAYS raw; we don't allow dynamic keys!
    const value = kvp[key];
    out[key] = marshallTokensToValue(value, ctx.evaluate);
  }
  return out;
}

export function normalizeModelList(value: SerialValue): string[] {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((entry) => castToString(entry).trim()).filter((entry) => !!entry);
  }
  return castToString(value)
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter((entry) => !!entry);
}

export async function gatherPromptAndSchemaForLLM(
  node: WellNode,
  ctx: StoryEventContext,
  doIncludeBareContent: boolean,
  instructions: LLMInstruction[] = [],
): Promise<{
  schema: Record<string, SerialValue>;
  instructions: LLMInstruction[];
}> {
  function append(role: LLMInstructionRole, content: string) {
    const last = instructions[instructions.length - 1];
    if (last && last.role === role) {
      last.content = last.content + "\n" + content;
    } else {
      instructions.push({ role, content });
    }
  }
  let schema: Record<string, SerialValue> = {};
  for (let i = 0; i < node.kids.length; i++) {
    const kid = node.kids[i];
    if (kid.type === SCHEMA_TYPE) {
      const body = await readBody(node, ctx);
      const parsed = parseSchemaBody(body, ctx);
      if (Object.keys(parsed).length > 0) {
        schema = { ...schema, ...parsed };
      }
      continue;
    }
    if (kid.type === PROMPT_USER_TYPE) {
      const value = await readBody(kid, ctx);
      if (value) {
        append("user", value);
      }
      continue;
    }
    if (kid.type === PROMPT_SYSTEM_TYPE) {
      const value = await readBody(kid, ctx);
      if (value) {
        append("system", value);
      }
      continue;
    }
    if (doIncludeBareContent) {
      const text = renderHandlebarsAndDDV((await marshallText(kid, ctx)).trim(), ctx);
      if (text) {
        append("user", text);
      }
    }
  }
  return { instructions, schema };
}

export function buildPromptWithMode(kvp: Record<string, SerialValue>) {
  if (LLM_SUBCOMMAND_PARSE in kvp) {
    return {
      prompt:
        `Parse the user's content. ${castToString(kvp[LLM_SUBCOMMAND_PARSE] ?? "")}\nReturn ONLY the content as the user requests.`.trim(),
      mode: LLM_SUBCOMMAND_PARSE,
    };
  }

  if (LLM_SUBCOMMAND_CLASSIFY in kvp) {
    return {
      prompt:
        `Classify the user's content per the schema and return an object with identical keys, whose values are classification scores between -1.0 (strong no) and 1.0 (strong yes). ${castToString(kvp[LLM_SUBCOMMAND_CLASSIFY] ?? "")}\nReturn ONLY the classification object.`.trim(),
      mode: LLM_SUBCOMMAND_CLASSIFY,
    };
  }

  if (LLM_SUBCOMMAND_GENERATE in kvp) {
    return {
      prompt:
        `Generate content. ${castToString(kvp[LLM_SUBCOMMAND_GENERATE] ?? "")}\nReturn ONLY the content requested.`.trim(),
      mode: LLM_SUBCOMMAND_GENERATE,
    };
  }

  if (LLM_SUBCOMMAND_NORMALIZE in kvp) {
    return {
      prompt:
        `Normalize user's message. ${castToString(kvp[LLM_SUBCOMMAND_NORMALIZE] ?? "")}\nReturn ONLY the normalized text.`.trim(),
      mode: LLM_SUBCOMMAND_NORMALIZE,
    };
  }

  return {
    prompt: "",
    mode: null,
  };
}

const JSON_SCHEMA_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["object"] },
    properties: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["string", "number", "integer", "boolean", "array", "object"] },
          description: { type: "string" },
          enum: { type: "array", items: { type: "string" } },
          items: { type: "object" },
        },
        required: ["type"],
        additionalProperties: false,
      },
    },
    required: { type: "array", items: { type: "string" } },
    additionalProperties: { type: "boolean" },
  },
  required: ["type", "properties", "required", "additionalProperties"],
  additionalProperties: false,
};

const DEFAULT_SCHEMA: JsonSchema = {
  type: "object",
  properties: { result: { type: "string" } },
  required: ["result"],
  additionalProperties: false,
};

export async function looseToJsonSchema(
  loose: Record<string, SerialValue>,
  ctx: StoryEventContext,
): Promise<JsonSchema> {
  if (Object.keys(loose).length === 0) {
    return DEFAULT_SCHEMA;
  }
  const description = Object.entries(loose)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  const instructions = [
    {
      role: "system" as const,
      content: [
        "Convert the user's schema description into a valid JSON Schema.",
        "The schema must be an object with properties, required array, and additionalProperties: false.",
        "Infer types from descriptions: 'number', 'integer', 'boolean', 'string', 'array', or 'object'.",
        "If enum values are listed (e.g., 'enum a | b | c'), include them in the enum array.",
        "All listed properties should be required.",
      ].join(" "),
    },
    { role: "user" as const, content: description },
  ];
  const generated = await ctx.llm(instructions, JSON_SCHEMA_SCHEMA, { models: [] });
  if (generated && typeof generated === "object" && "properties" in generated) {
    return generated as JsonSchema;
  }
  return DEFAULT_SCHEMA;
}

export async function fetchUrl(ctx: StoryEventContext, source: SerialValue): Promise<SerialValue | null> {
  const url = castToString(source ?? "");
  if (!isValidUrl(url)) {
    return null;
  }
  const response = await ctx.io({ kind: "fetch", url });
  if (response.status < 300) {
    return response.data;
  }
  return null;
}

export async function rawInputsToFullyReifiedMessages(
  inputs: RawInputShape[],
  ctx: StoryEventContext,
  doUseLLM: boolean,
): Promise<StoryEvent[]> {
  const results: StoryEvent[] = [];
  await parallel(inputs, async (input) => {
    const parsed = await rawInputToPartialMessage(input, ctx, doUseLLM);
    for (const partial of parsed) {
      const message = reifyEvent(
        {
          type: StoryEventType.$message,
          channel: "input",
          ...input, // This provides the 'from' value since ParsedMessageSpec doesn't
          ...partial,
        },
        ctx.rng.next,
      );
      results.push(message);
    }
  });
  return results;
}

export function marshallEaves(eave: string, ctx: StoryEventContext) {
  const tokens = tokenize(eave);
  const groups = splitArgTokens(tokens, EAVE_DELIM);
  return groups.map((group) => tokensToArgText(onlyNonSpaceTokens(group)));
}

function pathEquals(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
