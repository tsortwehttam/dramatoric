import fs from "node:fs";
import path from "node:path";

const DEFAULT_IN_DIR = "eng/directives";
const DEFAULT_OUT_FILE = "docs/directives-reference.md";

type DocSection = {
  name: string;
  summary: string[];
  syntax: string[];
  examples: string[];
  notes: string[];
};

const SECTION_NAMES = ["Summary", "Syntax", "Examples", "Notes"] as const;
type SectionKey = Lowercase<(typeof SECTION_NAMES)[number]>;

function stripStars(text: string) {
  return text
    .replace(/^\s*\/\*\*\s*/s, "")
    .replace(/\*\/\s*$/s, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trimEnd());
}

function trimBlank(lines: string[]) {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start += 1;
  while (end > start && lines[end - 1].trim() === "") end -= 1;
  return lines.slice(start, end);
}

function parseDocBlock(block: string): DocSection | null {
  const lines = stripStars(block);
  let name = "";
  let current: SectionKey | null = null;
  const sections: Record<SectionKey, string[]> = {
    summary: [],
    syntax: [],
    examples: [],
    notes: [],
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      name = line.replace(/^##\s+/, "").trim();
      continue;
    }
    const heading = SECTION_NAMES.find((h) => line === `**${h}**`);
    if (heading) {
      current = heading.toLowerCase() as SectionKey;
      continue;
    }
    if (!current) continue;
    sections[current].push(line);
  }

  if (!name) return null;

  return {
    name,
    summary: trimBlank(sections.summary),
    syntax: trimBlank(sections.syntax),
    examples: trimBlank(sections.examples),
    notes: trimBlank(sections.notes),
  };
}

function getDocsFromFile(file: string): DocSection[] {
  const text = fs.readFileSync(file, "utf8");
  const blocks = text.match(/\/\*\*[\s\S]*?\*\//g) ?? [];
  const docs: DocSection[] = [];
  for (const block of blocks) {
    const parsed = parseDocBlock(block);
    if (parsed) docs.push(parsed);
  }
  return docs;
}

function renderSection(title: string, lines: string[]) {
  if (!lines.length) return [];
  return [`**${title}**`, ...lines, ""];
}

function renderDoc(doc: DocSection) {
  const out: string[] = [];
  out.push(`## ${doc.name}`);
  out.push("");
  out.push(...renderSection("Summary", doc.summary));
  out.push(...renderSection("Syntax", doc.syntax));
  out.push(...renderSection("Examples", doc.examples));
  out.push(...renderSection("Notes", doc.notes));
  if (out[out.length - 1] !== "") out.push("");
  return out.join("\n");
}

function buildDocs(inDir: string, outFile: string) {
  const dir = path.resolve(process.cwd(), inDir);
  const out = path.resolve(process.cwd(), outFile);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join(dir, f));

  const docs: DocSection[] = [];
  for (const file of files) {
    docs.push(...getDocsFromFile(file));
  }

  docs.sort((a, b) => a.name.localeCompare(b.name));

  const sections: string[] = [];
  sections.push("# Directives Reference");
  sections.push("");
  sections.push(
    [
      "Directives are the building blocks of a Dramatoric story. They tell the story engine what to do: speak a line, wait, play sound, listen for input, or choose between paths.",
      "",
      "Most directives look like a heading with a colon, followed by text or a `DO...END` block. The heading names the action, and the body describes what should happen. Some directives can take extra settings on the same line after semicolons.",
      "",
      "Think of each stanza as a tiny instruction. You can stack them to shape pacing, mood, and interactivity. The reference below shows each directive in a consistent format so you can copy patterns and keep going.",
      "",
    ].join("\n"),
  );
  for (const doc of docs) {
    sections.push(renderDoc(doc));
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, sections.join("\n"));
}

export function main() {
  const inDir = process.argv[2] ?? DEFAULT_IN_DIR;
  const outFile = process.argv[3] ?? DEFAULT_OUT_FILE;
  buildDocs(inDir, outFile);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
