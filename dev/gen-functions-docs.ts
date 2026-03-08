import fs from "node:fs";
import path from "node:path";

const DEFAULT_IN_DIR = "eng/functions";
const DEFAULT_OUT_FILE = "docs/functions-reference.md";
const METHODS_SUFFIX = "Functions";

type DocParam = {
  name: string;
  desc: string;
};

type DocMethod = {
  name: string;
  summary: string[];
  params: DocParam[];
  returns: string;
  examples: string[];
  file: string;
};

function parseDoc(text: string) {
  const body = text.replace(/^\s*\/\*\*\s*/s, "").replace(/\*\/\s*$/s, "");
  const lines = body.split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trimEnd());

  const summary: string[] = [];
  const params: DocParam[] = [];
  const examples: string[] = [];
  let name = "";
  let returns = "";

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("@name")) {
      name = t.replace(/^@name\s+/, "").trim();
      continue;
    }
    if (t.startsWith("@param")) {
      const rest = t.replace(/^@param\s+/, "");
      const parts = rest.split(/\s+/);
      const pName = parts[0] ?? "";
      const desc = rest.slice(pName.length).trim();
      params.push({ name: pName, desc });
      continue;
    }
    if (t.startsWith("@returns")) {
      returns = t.replace(/^@returns\s+/, "").trim();
      continue;
    }
    if (t.startsWith("@example")) {
      examples.push(t.replace(/^@example\s+/, "").trim());
      continue;
    }
    if (t.startsWith("@")) continue;
    summary.push(line.trim());
  }

  return { name, summary, params, returns, examples };
}

function getMethodsFromFile(file: string): DocMethod[] {
  const text = fs.readFileSync(file, "utf8");
  const out: DocMethod[] = [];
  const blocks = text.match(/\/\*\*[\s\S]*?\*\//g) ?? [];
  for (const block of blocks) {
    const parsed = parseDoc(block);
    if (!parsed.name) continue;
    out.push({
      name: parsed.name,
      summary: parsed.summary,
      params: parsed.params,
      returns: parsed.returns,
      examples: parsed.examples,
      file,
    });
  }
  return out;
}

function titleFromFile(file: string) {
  const base = path.basename(file, path.extname(file));
  if (base.endsWith(METHODS_SUFFIX)) {
    const root = base.slice(0, -METHODS_SUFFIX.length);
    if (root.toLowerCase() === "rand") {
      return "Pseudo-Random Number Functions (Seeded)";
    }
    return `${root} Functions`;
  }
  return base;
}

function renderMethod(method: DocMethod) {
  const example = method.examples[0] ?? "";
  const cleaned = example.replace(/^lib\./, "");
  const desc = method.returns || method.summary.join(" ") || "Result.";
  return `| \`${cleaned}\` | ${desc} |`;
}

function buildDocs(inDir: string, outFile: string) {
  const dir = path.resolve(process.cwd(), inDir);
  const out = path.resolve(process.cwd(), outFile);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join(dir, f));

  const grouped: Record<string, DocMethod[]> = {};
  for (const file of files) {
    const items = getMethodsFromFile(file);
    if (!items.length) continue;
    const title = titleFromFile(file);
    grouped[title] = items.sort((a, b) => a.name.localeCompare(b.name));
  }

  const sections: string[] = [];
  sections.push("# Functions Reference");
  sections.push("");
  sections.push(
    [
      "Functions are small bits of code you can use inside expressions. They let you do simple math, compare values, or reshape text when you need a little extra control.",
      "",
      "Coding in Dramatoric inspired by programming languages like JavaScript — but it is much, much simpler, kept small and focused. You write short snippets of code using numbers, strings (text inside quotes), and variables (saved values). Like any coding (programming) language, symbols have to be typed exactly or the engine cannot understand your intent.",
      "",
      "A function is just like the 'functions' you learned about in math class — a kind of reusable tool that contains some math or logic. Like `toUpperCase('hello')` (converts the text string to uppercase letters). The part inside the parentheses is the input. The function returns a new value that you can use right away.",
      "",
      'In code there are different types of values, but you\'ll mainly deal with numbers and strings. Numbers are plain values like `1`, `2.5`, or `-3`. Strings are text like `"hello"` or `"a quiet room"`. (Note: If you forget quotes around text, it will be treated as a variable name instead of a string, so make sure to quote your text strings!)',
      "",
      "The reference below shows each method with a short example and a one-line description. You do not need to learn everything at once. Treat this as a menu you can dip into when you want to do something specific.",
    ].join("\n"),
  );

  const titles = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  for (const title of titles) {
    sections.push(`## ${title}`);
    sections.push("| Example | Returns |");
    sections.push("| --- | --- |");
    for (const method of grouped[title]) {
      sections.push(renderMethod(method));
    }
    sections.push("");
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
