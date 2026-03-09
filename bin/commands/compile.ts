import fs from "node:fs";
import path from "node:path";
import type { CommandModule } from "yargs";
import { compileCartridge, serializeSources } from "../../eng/Compiler.ts";
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

export const compile: CommandModule = {
  command: "compile <path>",
  describe: "Compile .dram files and output the merged result",
  builder: (y) =>
    y
      .positional("path", {
        describe: "Directory or .dram file to compile",
        type: "string",
        demandOption: true,
      })
      .option("output", {
        alias: "o",
        describe: "Output file (default: stdout)",
        type: "string",
        default: "-",
      }),
  handler: (args) => {
    const argv = args as unknown as { path: string; output: string };
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

    const errors: Array<{ type: string; name: string }> = [];
    const cartridge = reifyCartridge(cartridgeFiles);
    const sources = compileCartridge(cartridge, errors);

    if (errors.length > 0) {
      console.error(`${errors.length} error(s):`);
      for (const err of errors) {
        console.error(`  [${err.type}] ${err.name}`);
      }
      process.exit(1);
    }

    const out = serializeSources(sources);

    if (argv.output === "-") {
      process.stdout.write(out);
    } else {
      fs.writeFileSync(path.resolve(argv.output), out);
      console.info(`Wrote ${argv.output}`);
    }
  },
};
