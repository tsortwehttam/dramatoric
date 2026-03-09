import chalk from "chalk";
import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import type { CommandModule } from "yargs";
import { StoryEvent, StoryEventType } from "../../eng/Helpers.ts";
import { stringizeBufferObj } from "../../lib/BufferUtils.ts";
import { castToString } from "../../lib/EvalCasting.ts";
import { loadDirRecursive } from "../../lib/FileUtils.ts";
import { ConnectionStatus, createWebsocketClient } from "../../web/WebsocketClient.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIC_ROOT = path.resolve(ROOT, "fic");

export type RunArgs = {
  story: string;
  inputs: (string | number)[];
  param: (string | number)[];
  interactive: boolean;
  port: number;
  verbose: boolean;
};

function loadCartridge(slug: string) {
  const folder = slug.includes(path.sep) ? slug : path.join(FIC_ROOT, slug);
  return stringizeBufferObj(loadDirRecursive(folder));
}

function startWss(port: number, verbose: boolean): Promise<void> {
  return new Promise((resolve) => {
    if (verbose) console.info(chalk.dim("[wss] starting..."));
    const proc = spawn("yarn", ["wss"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", verbose ? "inherit" : "pipe"],
      env: { ...process.env, AUDIO_WS_PORT: String(port) },
    });
    proc.stdout!.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (verbose) process.stdout.write(chalk.dim(text));
      if (text.includes("listening on port")) resolve();
    });
    process.on("exit", () => proc.kill());
  });
}

function clearLine(): void {
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
}

function parseParams(raw: (string | number)[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of raw) {
    const s = String(entry);
    const eq = s.indexOf("=");
    if (eq === -1) {
      out[s] = "true";
    } else {
      out[s.slice(0, eq)] = s.slice(eq + 1);
    }
  }
  return out;
}

function runStory(slug: string, port: number, inputs: string[], params: Record<string, string>, interactive: boolean) {
  const url = `ws://localhost:${port}`;
  const cartridge = loadCartridge(slug);

  let rl: readline.Interface | null = null;
  if (interactive) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.green("> "),
    });
  }

  function inputOrPrompt() {
    const text = inputs.shift();
    if (text) {
      if (interactive) console.info(chalk.green(`> ${text}`));
      client.sendInput(text);
      return;
    }
    if (rl) {
      rl.prompt();
    } else {
      setTimeout(() => process.exit(0), 500);
    }
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
      if (interactive) clearLine();
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
      if (interactive) clearLine();
      console.error(chalk.red(`[error] ${error.message}`));
    },
    onStatusChange(status: ConnectionStatus) {
      if (status === "disconnected" || status === "error") {
        rl?.close();
      }
    },
    onTranscript(text: string, _id: string, final: boolean) {
      if (final && interactive) {
        clearLine();
        console.info(chalk.dim(`[transcribe] ${text}`));
      }
    },
  });

  if (rl) {
    rl.on("close", () => {
      client.close();
      process.exit(0);
    });
    rl.on("line", (line) => {
      const text = line.trim();
      if (!text) {
        rl!.prompt();
        return;
      }
      client.sendInput(text);
    });
  }

  client.connect().then(() => {
    client.boot(cartridge, { time: Date.now(), params });
    inputOrPrompt();
  });
}

export async function runHandler(argv: RunArgs) {
  const inputs = argv.inputs.map(castToString);
  const params = parseParams(argv.param);
  await startWss(argv.port, argv.verbose);
  runStory(argv.story, argv.port, inputs, params, argv.interactive);
}

export const run: CommandModule = {
  command: "run <story>",
  describe: "Run a story with pre-scripted inputs (headless or interactive fallback)",
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
        describe: "Inputs to feed the story in order",
        default: [],
      })
      .option("param", {
        type: "array",
        describe: "Session params as key=value pairs",
        default: [],
      })
      .option("interactive", {
        type: "boolean",
        describe: "Fall back to interactive prompt when inputs are exhausted (default: true if no inputs given)",
      })
      .option("verbose", {
        type: "boolean",
        describe: "Show WSS output",
        default: false,
      })
      .option("port", {
        alias: "p",
        type: "number",
        describe: "WebSocket server port",
        default: 8787,
      }),
  handler: async (args) => {
    const argv = args as unknown as {
      story: string;
      inputs: (string | number)[];
      param: (string | number)[];
      interactive: boolean | undefined;
      port: number;
      verbose: boolean;
    };

    await runHandler({
      story: argv.story,
      inputs: argv.inputs,
      param: argv.param,
      interactive: argv.interactive ?? argv.inputs.length === 0,
      port: argv.port,
      verbose: argv.verbose,
    });
  },
};
