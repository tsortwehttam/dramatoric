import { ChildProcess, spawn, spawnSync } from "node:child_process";

export type Ctrl = { pid: number; stop: () => void };

const hasFfplay = (() =>
  !spawnSync("ffplay", ["-version"], { stdio: "ignore" }).error)();
export const isFfplayAvailable = (): boolean => hasFfplay;

const buildArgs = (
  src: string,
  o: {
    volume?: number | null;
    fadeOutAt?: number | null;
    fadeOutDur?: number | null;
  }
) => {
  const args = ["-nodisp", "-autoexit", "-loglevel", "quiet"];
  const filters: string[] = [];
  if (typeof o.volume === "number") filters.push(`volume=${o.volume}`);
  if (o.fadeOutDur) {
    const st = o.fadeOutAt ?? 0.01;
    filters.push(`afade=t=out:st=${st}:d=${o.fadeOutDur}`);
    args.push("-t", String(st + o.fadeOutDur));
  }
  if (filters.length) args.push("-af", filters.join(","));
  args.push(src);
  return args;
};

export async function playWait(
  src: string,
  o: { volume?: number; fadeOutAt?: number; fadeOutDur?: number } = {},
  signal?: AbortSignal
): Promise<void> {
  if (!hasFfplay) return;
  if (signal?.aborted) return;
  const child = spawn("ffplay", buildArgs(src, { ...o }), {
    stdio: "ignore",
  });
  const onAbort = () => {
    child.kill("SIGINT");
  };
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
  await new Promise<void>((res, rej) => {
    child.once("error", (err) => {
      if (signal) signal.removeEventListener("abort", onAbort);
      rej(err);
    });
    child.once("exit", () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      res();
    });
  });
}

export function play(
  src: string,
  o: {
    volume?: number;
    loop?: boolean;
    fadeOutAt?: number;
    fadeOutDur?: number;
  } = {}
): Ctrl {
  if (!hasFfplay) return { pid: -1, stop: () => {} };
  const child: ChildProcess = spawn("ffplay", buildArgs(src, o), {
    stdio: "ignore",
  });
  return { pid: child.pid ?? -1, stop: () => child.kill("SIGINT") };
}
