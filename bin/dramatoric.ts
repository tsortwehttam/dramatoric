#!/usr/bin/env npx tsx
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { compile } from "./commands/compile.ts";
import { play } from "./commands/play.ts";
import { repl } from "./commands/repl.ts";
import { run } from "./commands/run.ts";
import { serve } from "./commands/serve.ts";
import { validate } from "./commands/validate.ts";

yargs(hideBin(process.argv))
  .scriptName("dramatoric")
  .usage("$0 <command> [options]")
  .command(compile)
  .command(play)
  .command(repl)
  .command(run)
  .command(serve)
  .command(validate)
  .demandCommand(1, "Run dramatoric --help for available commands")
  .strict()
  .help()
  .alias("h", "help")
  .version()
  .alias("v", "version")
  .parse();
