import { readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const DIR = dirname(fileURLToPath(import.meta.url));
const PROJ_ROOT = resolve(DIR, "..");
const SRC = join(PROJ_ROOT, "fic", "readme", "main.dramatoric");
const DEST = join(PROJ_ROOT, "README.md");

type Part = {
  kind: "md" | "well";
  text: string;
};

function splitParts(src: string): Part[] {
  const parts: Part[] = [];
  let i = 0;
  let start = 0;
  let inBlock = false;

  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    if (!inBlock && ch === "/" && next === "*") {
      if (i > start) {
        parts.push({ kind: "well", text: src.slice(start, i) });
      }
      inBlock = true;
      i += 2;
      start = i;
      continue;
    }

    if (inBlock && ch === "*" && next === "/") {
      parts.push({ kind: "md", text: src.slice(start, i) });
      inBlock = false;
      i += 2;
      start = i;
      continue;
    }

    i += 1;
  }

  if (inBlock) {
    throw new Error("Unclosed block comment in fic/readme/main.dramatoric");
  }

  if (start < src.length) {
    parts.push({ kind: "well", text: src.slice(start) });
  }

  return parts;
}

function trimEdgeNewlines(text: string): string {
  let out = text;
  while (out.startsWith("\n")) out = out.slice(1);
  while (out.endsWith("\n")) out = out.slice(0, -1);
  return out;
}

function unwrapMarkdown(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let buf: string[] = [];
  let inFence = false;
  let inList = false;

  function flush() {
    if (buf.length === 0) return;
    out.push(buf.join(" "));
    buf = [];
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    const isBlank = trimmed.length === 0;
    const isFence = /^```/.test(trimmed);
    const isHeading = /^#{1,6}\s+/.test(trimmed);
    const isList = /^(\s*(?:[-*+]|\d+\.)\s+)/.test(line);
    const isIndent = /^\s+/.test(line);

    if (isFence) {
      flush();
      out.push(line);
      inFence = !inFence;
      inList = false;
      continue;
    }

    if (inFence) {
      out.push(line);
      continue;
    }

    if (isBlank) {
      flush();
      out.push("");
      inList = false;
      continue;
    }

    if (isHeading) {
      flush();
      out.push(line);
      inList = false;
      continue;
    }

    if (isList) {
      flush();
      out.push(line);
      inList = true;
      continue;
    }

    if (inList && isIndent) {
      out.push(line);
      continue;
    }

    buf.push(trimmed);
    inList = false;
  }

  flush();
  return out.join("\n");
}

function buildReadme(parts: Part[]): string {
  const out: string[] = [];

  for (const part of parts) {
    const body = trimEdgeNewlines(part.text);
    if (part.kind === "md") {
      if (body.length > 0) out.push(unwrapMarkdown(body));
      continue;
    }
    if (body.trim().length === 0) continue;
    out.push(`\`\`\`well\n${body}\n\`\`\``);
  }

  return out.join("\n\n").trim() + "\n";
}

export function main() {
  const src = readFileSync(SRC).toString();
  const parts = splitParts(src);
  const readme = buildReadme(parts);
  writeFileSync(DEST, readme);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
