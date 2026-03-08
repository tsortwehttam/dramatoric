import { isDeepStrictEqual } from "util";
import { jsonStableStringify } from "../lib/JSONAndYAMLHelpers";

export function expectHas(actual: unknown, expected: Record<string, unknown>) {
  if (!actual || typeof actual !== "object") {
    throw new Error(`❌ example was not an object: ${actual}`);
  }
  const subset = pick(actual as Record<string, unknown>, Object.keys(expected));
  expect(subset, expected);
}

function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

export function expect(a: unknown, b: unknown) {
  const ja = jsonStableStringify(a) ?? "";
  const jb = jsonStableStringify(b) ?? "";
  if (isDeepStrictEqual(a, b)) {
    console.info("[test] ✅", `${ja} === ${jb}`);
    return;
  }
  const idx = firstDiffIdx(ja, jb);
  const diff = idx >= 0 ? `\n diff@${idx}\n A: ${sliceAround(ja, idx)}\n B: ${sliceAround(jb, idx)}` : "";
  throw new Error(`❌ ${ja}    ≠    ${jb}${diff}`);
}

function firstDiffIdx(a: string, b: string) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : len;
}

function sliceAround(s: string, idx: number) {
  const start = Math.max(0, idx - 20);
  const end = Math.min(s.length, idx + 20);
  const head = start > 0 ? "…" : "";
  const tail = end < s.length ? "…" : "";
  return `${head}${s.slice(start, end)}${tail}`;
}
