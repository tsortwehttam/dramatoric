import type { RawData } from "ws";

export type AudioBufferEncoding = "float32" | "pcm16";

export const DEFAULT_SAMPLE_RATE = 16000;
export const TARGET_SAMPLE_RATE = 24000;

export function ensurePcm16(
  buffer: Buffer,
  encoding: AudioBufferEncoding
): Buffer {
  if (encoding === "pcm16") {
    const evenLength = buffer.byteLength - (buffer.byteLength % 2);
    if (evenLength === buffer.byteLength) {
      return buffer;
    }
    return buffer.subarray(0, evenLength);
  }
  return convertFloat32Buffer(buffer);
}

export function convertInt16ToFloat32(input: Int16Array): Float32Array {
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    output[i] = input[i] / 0x7fff;
  }
  return output;
}

export function convertFloat32ToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));

    output[i] = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff);
  }
  return output;
}

export function convertFloat32Buffer(buffer: Buffer): Buffer {
  const stride = Float32Array.BYTES_PER_ELEMENT;
  const usable = buffer.byteLength - (buffer.byteLength % stride);
  if (usable <= 0) {
    return Buffer.alloc(0);
  }
  const view = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    usable / stride
  );
  const result = Buffer.alloc(view.length * 2);
  for (let index = 0; index < view.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, view[index]));
    const value = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    result.writeInt16LE(Math.round(value), index * 2);
  }
  return result;
}

export function normalizeInput(data: RawData | Buffer): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (Array.isArray(data)) {
    return Buffer.concat(
      data.map((chunk) => {
        return normalizeInput(chunk);
      })
    );
  }
  return Buffer.from(data);
}

export function toBuffer(audio: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (audio instanceof Buffer) {
    return audio;
  }
  if (audio instanceof ArrayBuffer) {
    return Buffer.from(audio);
  }
  return Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
}
