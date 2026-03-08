import { Readable } from "stream";
import unzipper from "unzipper";

// Readable.toArray() isn't in Node 20; iterate manually
export async function toBuffer(body: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export async function unzip(zip: Buffer): Promise<Record<string, Buffer>> {
  const dir = await unzipper.Open.buffer(zip);
  const sources: Record<string, Buffer> = {};
  for (const file of dir.files) {
    const buffer = await file.buffer();
    sources[file.path] = buffer;
  }
  return sources;
}

export function stringizeBufferObj(obj: Record<string, string | Buffer>) {
  const out: Record<string, string> = {};
  for (const key in obj) {
    out[key] = obj[key].toString();
  }
  return out;
}
