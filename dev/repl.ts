import chalk from "chalk";
import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { StoryEvent, StoryEventType } from "../eng/Helpers";
import { loadEnv } from "../env";
import { stringizeBufferObj } from "../lib/BufferUtils";
import { castToString } from "../lib/EvalCasting";
import { loadDirRecursive } from "../lib/FileUtils";
import { ConnectionStatus, createWebsocketClient } from "../web/WebsocketClient";

const env = loadEnv();
const DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJ_ROOT = path.resolve(DIR, "..");
const FIC_ROOT = path.resolve(PROJ_ROOT, "fic");

function clearLine(): void {
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
}

function loadCartridge(slug: string) {
  const folder = slug.includes(path.sep) ? slug : path.join(FIC_ROOT, slug);
  const cartridge = stringizeBufferObj(loadDirRecursive(folder));
  return cartridge;
}

function start(slug: string, inputs: string[]) {
  const port = env.AUDIO_WS_PORT ?? "8787";
  const url = `ws://localhost:${port}`;
  console.info(chalk.dim(`[repl] load ${slug}`));
  const cartridge = loadCartridge(slug);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green("> "),
  });

  function inputOrPrompt() {
    const text = inputs.shift();
    if (text) {
      console.info(chalk.green(`> ${text}`));
      client.sendInput(text);
      return;
    }
    rl.prompt();
  }

  let pendingPrompt = false;

  function schedulePrompt() {
    if (pendingPrompt) return;
    pendingPrompt = true;
    setImmediate(() => {
      pendingPrompt = false;
      inputOrPrompt();
    });
  }

  const client = createWebsocketClient({
    url,
    onEvent(event: StoryEvent) {
      clearLine();
      if (event.type === StoryEventType.$media || event.type === StoryEventType.$message) {
        const from = chalk.bold.cyan(event.from);
        const value = event.value.trim();
        const urlSuffix = event.url ? chalk.dim(` [${event.url}]`) : "";
        console.info(`${from}: ${value}${urlSuffix}`);
      } else if (event.type === StoryEventType.$exit) {
        console.info(chalk.magenta("[exit]"));
        process.exit(0);
      }
      schedulePrompt();
    },
    onError(error: Error) {
      clearLine();
      console.error(chalk.red(`[error] ${error.message}`));
    },
    onStatusChange(status: ConnectionStatus) {
      if (status === "disconnected") {
        console.info(chalk.dim("[repl] disconnected"));
        rl.close();
      } else if (status === "error") {
        rl.close();
      }
    },
    onTranscript(text: string, id: string, final: boolean) {
      if (final) {
        clearLine();
        console.info(chalk.dim(`[transcribe] ${text}`));
      }
    },
  });

  rl.on("close", () => {
    client.close();
    process.exit(0);
  });

  rl.on("line", (line) => {
    const text = line.trim();
    if (!text) {
      rl.prompt();
      return;
    }
    client.sendInput(text);
  });

  client.connect().then(() => {
    console.info(chalk.dim("[repl] connected"));
    client.boot(cartridge, { time: Date.now() });
    inputOrPrompt();
  });
}

function startWss(verbose: boolean): Promise<void> {
  return new Promise((resolve) => {
    console.info(chalk.dim("[repl] starting"));
    const proc = spawn("yarn", ["wss"], {
      cwd: path.resolve(DIR, ".."),
      stdio: ["ignore", "pipe", "inherit"],
    });
    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (verbose) {
        process.stdout.write(chalk.dim(text));
      }
      if (text.includes("listening on port")) {
        resolve();
      }
    });
    process.on("exit", () => proc.kill());
  });
}

async function run() {
  const argv = await yargs(hideBin(process.argv))
    .option("inputs", {
      alias: "i",
      type: "array",
      description: "Array of raw inputs to send into the story, in order",
      default: [],
    })
    .option("verbose", {
      alias: "v",
      type: "boolean",
      description: "Log verbose output",
      default: true,
    })
    .parserConfiguration({
      "camel-case-expansion": true,
      "strip-aliased": true,
    })
    .help()
    .parse();

  const slug = argv._[0];
  if (!slug) {
    console.error("Usage: yarn tsx dev/run-repl-local.ts <slug>");
    process.exit(1);
  }

  await startWss(argv.verbose);
  start(castToString(slug), argv.inputs.map(castToString));
}

run();
