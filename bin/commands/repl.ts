import type { CommandModule } from "yargs";
import { runHandler, RunArgs } from "./run.ts";

export const repl: CommandModule = {
  command: "repl <story>",
  describe: "Play a story interactively in the terminal (alias for run --interactive)",
  builder: (y) =>
    y
      .positional("story", {
        describe: "Story slug (from fic/) or path to a directory",
        type: "string",
        demandOption: true,
      })
      .option("inputs", {
        alias: "i",
        type: "array",
        describe: "Pre-scripted inputs to send in order",
        default: [],
      })
      .option("port", {
        alias: "p",
        type: "number",
        describe: "WebSocket server port",
        default: 8787,
      })
      .option("verbose", {
        type: "boolean",
        describe: "Show WSS output",
        default: true,
      }),
  handler: async (args) => {
    const argv = args as unknown as { story: string; inputs: (string | number)[]; port: number; verbose: boolean };
    await runHandler({
      story: argv.story,
      inputs: argv.inputs,
      param: [],
      interactive: true,
      port: argv.port,
      verbose: argv.verbose,
    });
  },
};
