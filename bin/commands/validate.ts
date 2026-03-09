import fs from "node:fs";
import path from "node:path";
import type { CommandModule } from "yargs";
import { compileCartridge } from "../../eng/Compiler.ts";
import { reifyCartridge, WELL_EXT } from "../../eng/Helpers.ts";

function collectFiles(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!fs.statSync(full).isFile()) continue;
    if (
      entry.endsWith(WELL_EXT) ||
      entry.endsWith(".json") ||
      entry.endsWith(".yaml") ||
      entry.endsWith(".yml")
    ) {
      files[entry] = fs.readFileSync(full, "utf8");
    }
  }
  return files;
}

function countNodes(node: { kids?: Array<Record<string, unknown>> }): number {
  let count = 1;
  for (const kid of (node.kids ?? []) as Array<typeof node>) {
    count += countNodes(kid);
  }
  return count;
}

export const validate: CommandModule = {
  command: "validate <path>",
  describe: "Validate .dram files for syntax errors",
  builder: (y) =>
    y.positional("path", {
      describe: "Directory or .dram file to validate",
      type: "string",
      demandOption: true,
    }),
  handler: (args) => {
    const argv = args as unknown as { path: string };
    const resolved = path.resolve(argv.path);

    if (!fs.existsSync(resolved)) {
      console.error(`Not found: ${argv.path}`);
      process.exit(1);
    }

    const stat = fs.statSync(resolved);
    let cartridgeFiles: Record<string, string>;

    if (stat.isDirectory()) {
      cartridgeFiles = collectFiles(resolved);
    } else if (resolved.endsWith(WELL_EXT)) {
      cartridgeFiles = { [path.basename(resolved)]: fs.readFileSync(resolved, "utf8") };
    } else {
      console.error(`Not a .dram file or directory: ${argv.path}`);
      process.exit(1);
    }

    const wellFiles = Object.keys(cartridgeFiles).filter((k) => k.endsWith(WELL_EXT));
    if (wellFiles.length === 0) {
      console.error(`No .dram files found in ${argv.path}`);
      process.exit(1);
    }

    console.info(`Validating ${wellFiles.length} file(s) from ${argv.path}`);

    const errors: Array<{ type: string; name: string }> = [];
    const cartridge = reifyCartridge(cartridgeFiles);
    const sources = compileCartridge(cartridge, errors);

    if (errors.length === 0) {
      console.info(`OK — ${countNodes(sources.root)} nodes, no errors`);
      process.exit(0);
    }

    console.error(`${errors.length} error(s):`);
    for (const err of errors) {
      console.error(`  [${err.type}] ${err.name}`);
    }
    process.exit(1);
  },
};
