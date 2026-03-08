/**
 * This module sets up a WebSocket server that acts as a proxy between a client sending
 * a real-time audio stream and OpenAI's real-time transcription service.
 *
 * It handles the following:
 * - Receiving audio data from a client WebSocket connection.
 * - Forwarding the audio to OpenAI's transcription service.
 * - Buffering audio chunks to meet the minimum duration required by OpenAI.
 * - Committing the audio buffer after a certain duration or after a pause in the audio stream.
 * - Sending partial and final transcription results back to the client.
 */
import { ConverterType, create } from "@alexanderolsen/libsamplerate-js";
import { createServer, IncomingMessage } from "node:http";
import { RawData, WebSocket, WebSocketServer } from "ws";
import { compileCartridge } from "../eng/Compiler";
import { ContextCallbacks, createContext, step } from "../eng/Engine";
import { reifyCartridge, reifySession, StoryEventContext } from "../eng/Helpers";
import { createIO } from "../eng/io/WellBackendIO";
import { loadEnv } from "../env";
import {
  AudioBufferEncoding,
  convertFloat32ToInt16,
  convertInt16ToFloat32,
  DEFAULT_SAMPLE_RATE,
  ensurePcm16,
  normalizeInput,
  TARGET_SAMPLE_RATE,
} from "../lib/AudioBufferHelpers";
import { createTranscriptionClient, TranscriptionClient } from "../lib/OpenAITranscriptionClient";
import { decodeSocketInboundMessage, decodeSocketResponseEnvelope, SocketInboundMessage } from "../lib/SocketTypings";
import { registerSocketResponse, rejectAllPendingRequests, sendJson } from "../lib/WebsocketServerUtils";

const env = loadEnv();
const io = createIO(env);

type ConnectionState = {
  encoding: AudioBufferEncoding;
  ready: boolean;
  formatReady: boolean;
  queue: Buffer[];
  closed: boolean;
  resampler: Awaited<ReturnType<typeof create>> | null;
  sampleRate: number;
};

const port = Number(env.AUDIO_WS_PORT ?? "8787");
const server = createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (socket: WebSocket, request: IncomingMessage) => {
  let game: StoryEventContext | null = null;
  let transcriber: TranscriptionClient | null = null;
  const url = new URL(request.url ?? "", `http://${request.headers.host}`);
  const params: Record<string, string> = Object.fromEntries(url.searchParams);

  const state: ConnectionState = {
    encoding: "float32",
    ready: false,
    formatReady: false,
    queue: [],
    closed: false,
    resampler: null,
    sampleRate: DEFAULT_SAMPLE_RATE,
  };

  const remoteAddress = request.socket?.remoteAddress ?? "unknown";
  const remotePort = request.socket?.remotePort ?? 0;
  console.info(`[wss] connection open ${remoteAddress}:${remotePort} ${url.pathname}${url.search}`);

  sendJson(socket, {
    type: "transcriber_status",
    message: "connected",
  });

  const callbacks: ContextCallbacks = {
    onEvent: (event) => {
      sendJson(socket, { type: "game_event", data: event });
    },
    onError: (error) => {
      sendJson(socket, { type: "game_error", message: error.message });
    },
  };

  async function handleInboundMessage(payload: SocketInboundMessage): Promise<void> {
    switch (payload.type) {
      case "boot": {
        console.info("[wss] boot");
        let { session, sources } = payload;
        if (!sources && payload.cartridge) {
          const cartridge = reifyCartridge(payload.cartridge);
          sources = compileCartridge(cartridge);
        }
        if (!sources) {
          sendJson(socket, { type: "game_error", message: "missing sources or cartridge" });
          return;
        }
        if (!session) {
          session = reifySession({});
        }
        game = createContext(io, session, sources, callbacks);
        await step(game);
        break;
      }
      case "transcriber_start":
        console.info(`[wss] transcriber_start`);
        if (!env.OPENAI_API_KEY) {
          sendJson(socket, { type: "game_error", message: "OPENAI_API_KEY required for transcription" });
          break;
        }
        if (!transcriber) {
          transcriber = createTranscriptionClient({
            language: params.language ?? "en",
            apiKey: env.OPENAI_API_KEY,
            onPartial: function (text, itemId) {
              console.info("[transcribe] input_chunk", itemId, text);
              sendJson(socket, {
                type: "transcriber_input_chunk",
                text,
                id: itemId,
              });
            },
            onFinal: function (text, itemId) {
              console.info("[transcribe] input_final", itemId, text);
              sendJson(socket, {
                type: "transcriber_input_final",
                text,
                id: itemId,
              });
              if (game) {
                game.session.inputs.push({ from: game.session.player.id, raw: text });
              }
            },
            onError: function (error) {
              console.error("[transcribe] error", error.message);
              sendJson(socket, {
                type: "transcriber_error",
                message: error.message,
              });
            },
          });

          transcriber
            .connect()
            .then(function () {
              if (state.closed || !transcriber) {
                transcriber?.close();
                return;
              }
              console.info("[wss] transcriber connected");
              state.ready = true;
              flushQueuedAudio(transcriber, state);
              sendJson(socket, {
                type: "transcriber_status",
                message: "transcribing",
              });
            })
            .catch(function (error) {
              console.error(`[wss] transcriber connect failed: ${normalizeErrorMessage(error)}`);
              sendJson(socket, {
                type: "transcriber_error",
                message: normalizeErrorMessage(error),
              });
            });
        }
        break;
      case "transcriber_stop":
        console.info("[wss] transcriber_stop received");
        if (transcriber) {
          transcriber.close();
          transcriber = null;
          state.ready = false;
          state.queue = [];
          sendJson(socket, {
            type: "transcriber_status",
            message: "stopped",
          });
        }
        break;
      case "manual_input_final":
        console.info("[wss] input_final", payload.text);
        if (game) {
          game.session.inputs.push({ from: game.session.player.id, raw: payload.text });
          await step(game);
        }
        sendJson(socket, {
          type: "manual_input_final",
          text: payload.text,
        });
        break;
      case "get_session":
        console.info("[wss] get_session");
        if (game) {
          sendJson(socket, { type: "session_snapshot", session: game.session });
        }
        break;
      default:
        break;
    }
  }

  socket.on("message", async function (data, isBinary) {
    if (state.closed) {
      return;
    }

    const size = getRawDataSize(data);
    console.info(`[wss] message received binary=${isBinary} bytes=${size}`);

    if (!isBinary) {
      const raw = rawDataToString(data);
      console.info("[wss] message string", raw);
      try {
        const parsed = JSON.parse(raw);
        const envelope = decodeSocketResponseEnvelope(parsed);
        if (envelope.ok) {
          const handled = registerSocketResponse(socket, envelope.value);
          if (handled) {
            console.info(`[wss] response matched seq payload`);
            return;
          }
          await handleInboundMessage(envelope.value.payload);
          return;
        }
        const payload = decodeSocketInboundMessage(parsed);
        if (payload.ok) {
          await handleInboundMessage(payload.value);
          return;
        }
        await handleDefaultPayload(raw, state, transcriber);
      } catch (error) {
        await handleDefaultPayload(raw, state, transcriber);
      }
      return;
    }

    if (transcriber) {
      handleBinaryData(data, state, transcriber);
    }
  });

  socket.on("close", function () {
    console.info("[wss] socket closed");
    state.closed = true;
    state.queue = [];
    if (state.resampler) {
      state.resampler.destroy();
      state.resampler = null;
    }
    if (transcriber) {
      transcriber.close();
    }
    rejectAllPendingRequests(socket, new Error("socket closed"));
  });

  socket.on("error", function () {
    console.error("[wss] socket error");
    if (!state.closed) {
      socket.close();
    }
    rejectAllPendingRequests(socket, new Error("socket error"));
  });
});

server.listen(port, () => {
  process.stdout.write(`wss listening on port ${port}\n`);
});

function rawDataToString(data: RawData): string {
  if (typeof data === "string") {
    return data;
  }
  return normalizeInput(data).toString("utf8");
}

function flushQueuedAudio(transcription: TranscriptionClient | null, state: ConnectionState): void {
  if (!transcription || !state.ready || !state.formatReady || state.queue.length === 0) {
    return;
  }
  state.queue.forEach(function (chunk) {
    processPcmChunk(transcription, chunk, state);
  });
  state.queue = [];
}

function processPcmChunk(transcription: TranscriptionClient | null, chunk: Buffer, state: ConnectionState): void {
  if (!transcription || chunk.byteLength === 0) {
    return;
  }
  const aligned = ensureTargetSampleRate(chunk, state.sampleRate, state);
  if (aligned.byteLength === 0) {
    return;
  }
  transcription.sendAudio(aligned);
}

export function ensureTargetSampleRate(buffer: Buffer, sampleRate: number, state: ConnectionState): Buffer {
  if (sampleRate <= 0 || sampleRate === TARGET_SAMPLE_RATE || !state.resampler) {
    return buffer;
  }
  const samples = buffer.byteLength / 2;
  if (samples <= 0) {
    return Buffer.alloc(0);
  }
  const input = new Int16Array(buffer.buffer, buffer.byteOffset, samples);
  const inputFloat32 = convertInt16ToFloat32(input);
  const resultFloat32 = state.resampler.simple(inputFloat32);
  const resultInt16 = convertFloat32ToInt16(resultFloat32);
  return Buffer.from(resultInt16.buffer, resultInt16.byteOffset, resultInt16.byteLength);
}

async function applyFormatMessage(text: string, state: ConnectionState): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed.startsWith("FORMAT")) {
    return false;
  }
  const parts = trimmed.split(/\s+/);
  const encoding = parts[1];
  if (encoding === "float32" || encoding === "pcm16") {
    state.encoding = encoding;
  }
  const rateText = parts[2];
  const rate = Number(rateText);
  if (Number.isFinite(rate) && rate > 0) {
    state.sampleRate = rate;
    if (rate !== TARGET_SAMPLE_RATE) {
      state.resampler = await create(1, rate, TARGET_SAMPLE_RATE, {
        converterType: ConverterType.SRC_SINC_FASTEST,
      });
    }
    state.formatReady = true;
    return true;
  }
  return false;
}

function normalizeErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const info = error as Record<string, unknown>;
    const message = info.message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "transcription unavailable";
}

function handleBinaryData(data: RawData, state: ConnectionState, transcriber: TranscriptionClient | null) {
  // In this code path the data is already binary
  const buffer = normalizeInput(data);
  console.info(`[wss] binary chunk received bytes=${buffer.byteLength}`);
  if (buffer.byteLength < 16) {
    return;
  }
  const pcm16 = ensurePcm16(buffer, state.encoding);
  if (pcm16.byteLength === 0) {
    return;
  }
  if (!state.ready || !state.formatReady) {
    console.info(`[wss] queueing audio chunk bytes=${pcm16.byteLength}`);
    state.queue.push(pcm16);
    return;
  }
  console.info(`[wss] streaming audio chunk bytes=${pcm16.byteLength}`);
  processPcmChunk(transcriber, pcm16, state);
}

async function handleDefaultPayload(text: string, state: ConnectionState, transcriber: TranscriptionClient | null) {
  const updated = await applyFormatMessage(text, state);
  if (updated) {
    console.info(
      `[wss] state updated: encoding=${state.encoding}, sampleRate=${state.sampleRate}, formatReady=${state.formatReady}`,
    );
    flushQueuedAudio(transcriber, state);
  }
}

function getRawDataSize(data: RawData | string): number {
  if (typeof data === "string") {
    return data.length;
  }
  if (isBufferArray(data)) {
    let total = 0;
    for (const chunk of data) {
      total += chunk.byteLength;
    }
    return total;
  }
  if (data instanceof ArrayBuffer) {
    return data.byteLength;
  }
  return data.byteLength;
}

function isBufferArray(data: RawData | string): data is Buffer[] {
  return Array.isArray(data);
}
