import { spawn } from "child_process";

export async function zipDir(dir: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const child = spawn("zip", ["-qr", "-", "."], { cwd: dir });
    const chunks: Buffer[] = [];
    let done = false;
    child.stdout.on("data", (chunk) => {
      if (done) return;
      chunks.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk) => {
      if (done) return;
      console.warn(chunk.toString());
    });
    child.on("error", () => {
      if (done) return;
      done = true;
      console.warn("zip process error");
      resolve(null);
    });
    child.on("close", (code) => {
      if (done) return;
      done = true;
      if (code !== 0) {
        console.warn("zip failed");
        resolve(null);
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });
}
