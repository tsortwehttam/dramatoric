import fs from "node:fs";
import path from "node:path";
import { parseDSL } from "../../eng/Compiler";
import { WellNode } from "../../eng/Helpers";

const CWD = process.cwd();
const DOCS_DIR = path.join(CWD, "docs");
const DEFAULT_EXAMPLE_FILES = ["fic/example/main.dramatoric"];

function readFile(filepath: string): string {
  return fs.readFileSync(path.resolve(CWD, filepath), "utf8");
}

export type ParsedExample = {
  path: string;
  source: string;
  ast: WellNode;
  meta: Record<string, unknown>;
};

export function parseFile(filepath: string): ParsedExample {
  const source = readFile(filepath);
  if (!source) {
    throw new Error(`Example source missing: ${filepath}`);
  }
  const result = parseDSL(source);
  if ("errors" in result) {
    throw new Error(`Example source errors: ${filepath}`);
  }
  return {
    path: filepath,
    source,
    ast: result.root,
    meta: result.meta ?? {},
  };
}

export type DocsContext = {
  directives: string;
  functions: string;
  readme: string;
};

export function gatherDocs(): DocsContext {
  return {
    directives: readFile(path.join(DOCS_DIR, "directives-reference.md")),
    functions: readFile(path.join(DOCS_DIR, "functions-reference.md")),
    readme: readFile(path.join(CWD, "README.md")),
  };
}

export type GeneratorContext = {
  docs: DocsContext;
  examples: ParsedExample[];
};

export function buildContext(exampleFiles: string[] = DEFAULT_EXAMPLE_FILES): GeneratorContext {
  return {
    docs: gatherDocs(),
    examples: exampleFiles.map(parseFile),
  };
}
