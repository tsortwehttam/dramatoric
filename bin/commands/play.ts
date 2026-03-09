import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CommandModule } from "yargs";
import { stringizeBufferObj } from "../../lib/BufferUtils.ts";
import { loadDirRecursive } from "../../lib/FileUtils.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PLAY_DIR = path.resolve(ROOT, "play");
const PUBLIC_DIR = path.resolve(PLAY_DIR, "public");
const PRELOADED = path.resolve(PUBLIC_DIR, "_preloaded.json");

function loadCartridge(cartridgePath: string): Record<string, string> {
  const resolved = path.isAbsolute(cartridgePath) ? cartridgePath : path.resolve(process.cwd(), cartridgePath);
  if (!existsSync(resolved)) {
    console.error(`Cartridge not found: ${resolved}`);
    process.exit(1);
  }
  const stat = statSync(resolved);
  if (stat.isFile()) {
    const name = path.basename(resolved);
    const key = name.endsWith(".dram") ? name : "main.dram";
    return { [key]: readFileSync(resolved, "utf-8") };
  }
  return stringizeBufferObj(loadDirRecursive(resolved));
}

function loadSession(sessionPath: string): Record<string, unknown> {
  const resolved = path.isAbsolute(sessionPath) ? sessionPath : path.resolve(process.cwd(), sessionPath);
  if (!existsSync(resolved)) {
    console.error(`Session file not found: ${resolved}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(resolved, "utf-8"));
}

function spawnChild(cmd: string, args: string[], cwd: string, readySignal: string): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "inherit"] });
    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (text.includes(readySignal)) resolve();
    });
    process.on("exit", () => proc.kill());
  });
}

function cleanup() {
  if (existsSync(PRELOADED)) unlinkSync(PRELOADED);
}

export const play: CommandModule = {
  command: "play",
  describe: "Launch the web player (WSS + Vite dev server)",
  builder: (y) =>
    y
      .option("cartridge", {
        alias: "c",
        type: "string",
        describe: "Path to a .dram file or directory to pre-load",
      })
      .option("session", {
        alias: "s",
        type: "string",
        describe: "Path to a session .json file to resume from",
      })
      .option("port", {
        alias: "p",
        type: "number",
        describe: "WebSocket server port",
        default: 8787,
      }),
  handler: async (args) => {
    const argv = args as unknown as { cartridge: string | undefined; session: string | undefined; port: number };

    cleanup();

    if (argv.cartridge) {
      const cartridge = loadCartridge(argv.cartridge);
      const payload: Record<string, unknown> = { cartridge };
      if (argv.session) {
        payload.session = loadSession(argv.session);
      }
      if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });
      writeFileSync(PRELOADED, JSON.stringify(payload));
      console.info(`[play] pre-loaded cartridge: ${argv.cartridge}`);
    } else if (argv.session) {
      console.warn("[play] --session requires --cartridge to boot a story");
    }

    process.on("exit", cleanup);
    process.on("SIGINT", () => {
      cleanup();
      process.exit(0);
    });

    process.env.AUDIO_WS_PORT = String(argv.port);

    console.info("[play] starting...");
    await spawnChild("yarn", ["wss"], ROOT, "listening on port");
    console.info("[play] wss ready");
    await spawnChild("npx", ["vite", "--config", path.resolve(PLAY_DIR, "vite.config.ts")], PLAY_DIR, "ready in");
    console.info("[play] vite ready");
  },
};
