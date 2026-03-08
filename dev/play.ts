import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { stringizeBufferObj } from "../lib/BufferUtils";
import { loadDirRecursive } from "../lib/FileUtils";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "..");
const PLAY_DIR = path.resolve(ROOT, "play");
const PUBLIC_DIR = path.resolve(PLAY_DIR, "public");
const PRELOADED = path.resolve(PUBLIC_DIR, "_preloaded.json");

function loadCartridge(cartridgePath: string): Record<string, string> {
  const resolved = path.isAbsolute(cartridgePath) ? cartridgePath : path.resolve(ROOT, cartridgePath);
  if (!existsSync(resolved)) {
    console.error(`Cartridge not found: ${resolved}`);
    process.exit(1);
  }
  const stat = statSync(resolved);
  if (stat.isFile()) {
    const name = path.basename(resolved);
    const key = name.endsWith(".dramatoric") ? name : "main.dramatoric";
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

function startWss(): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn("yarn", ["wss"], { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"] });
    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (text.includes("listening on port")) resolve();
    });
    process.on("exit", () => proc.kill());
  });
}

function startVite(): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn("npx", ["vite", "--config", path.resolve(PLAY_DIR, "vite.config.ts")], {
      cwd: PLAY_DIR,
      stdio: ["ignore", "pipe", "inherit"],
    });
    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (text.includes("Local:") || text.includes("ready in")) resolve();
    });
    process.on("exit", () => proc.kill());
  });
}

function cleanup() {
  if (existsSync(PRELOADED)) {
    unlinkSync(PRELOADED);
  }
}

async function run() {
  const argv = await yargs(hideBin(process.argv))
    .option("cartridge", {
      alias: "c",
      type: "string",
      description: "Path to a .dramatoric file or directory to pre-load",
    })
    .option("session", {
      alias: "s",
      type: "string",
      description: "Path to a session .json file to resume from",
    })
    .help()
    .parse();

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

  console.info("[play] starting...");
  await startWss();
  console.info("[play] wss ready");
  await startVite();
  console.info("[play] vite ready");
}

run();
