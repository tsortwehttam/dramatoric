import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { compileCartridge } from "../eng/Compiler";
import { reifyCartridge } from "../eng/Helpers";
import { extractWellBlocks } from "../lib/MarkdownUtils";
import { expect } from "./TestUtils";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJ_ROOT = path.resolve(DIR, "..");

async function test() {
  const readme = readFileSync(path.join(PROJ_ROOT, "README.md")).toString();
  const script = extractWellBlocks(readme);
  console.info("[test] extracted README Dramatoric script:\n", script);
  const cartridge = reifyCartridge(script);
  const result = await compileCartridge(cartridge);
  const syntaxErrs = result.errs.filter((e) => e.type === "syntax-error");
  expect(syntaxErrs.length, 0);
  console.info("[test] ✅ README compiles without syntax errors");
}

test();
