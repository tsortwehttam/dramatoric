import { WebSocket } from "ws";
import { toBuffer } from "./AudioBufferHelpers";

type TranscriptionClientOptions = {
  apiKey: string;
  language: string;
  onPartial: (text: string, itemId: string) => void;
  onFinal: (text: string, itemId: string) => void;
  onError: (error: Error) => void;
};

export type TranscriptionClient = {
  connect: () => Promise<void>;
  sendAudio: (audio: Buffer | Uint8Array | ArrayBuffer) => void;
  close: () => void;
};

const API_URL = "wss://api.openai.com/v1/realtime?intent=transcription";
const TS_MODEL = "gpt-4o-transcribe";

export const createTranscriptionClient = (options: TranscriptionClientOptions): TranscriptionClient => {
  let ws: WebSocket | null = null;

  function sendSessionUpdate(): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const msg = {
      type: "transcription_session.update",
      session: {
        input_audio_format: "pcm16",
        input_audio_transcription: {
          model: TS_MODEL,
          language: options.language,
        },
        turn_detection: { type: "server_vad" },
      },
    };
    ws.send(JSON.stringify(msg));
  }

  const connect = () =>
    new Promise<void>((resolve, reject) => {
      ws = new WebSocket(API_URL, {
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });

      ws.on("open", () => {
        sendSessionUpdate();
        resolve();
      });

      ws.on("message", (data) => {
        const event = JSON.parse(data.toString());
        if (event.type === "conversation.item.input_audio_transcription.delta") {
          options.onPartial(event.delta, event.item_id);
        } else if (event.type === "conversation.item.input_audio_transcription.completed") {
          options.onFinal(event.transcript, event.item_id);
        } else if (event.type === "conversation.item.input_audio_transcription.failed") {
          options.onError(new Error(event.error?.message ?? "transcription failed"));
        } else if (event.type === "error") {
          options.onError(new Error(event.error?.message ?? "realtime error"));
        }
      });

      ws.on("error", (err) => {
        options.onError?.(err as Error);
        if (ws && ws.readyState !== WebSocket.OPEN) reject(err);
      });
    });

  function sendAudio(audio: Buffer | Uint8Array | ArrayBuffer): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const b = toBuffer(audio);
    const audioBase64 = b.toString("base64");
    const msg = { type: "input_audio_buffer.append", audio: audioBase64 };
    ws.send(JSON.stringify(msg));
  }

  function close(): void {
    if (!ws) {
      return;
    }
    ws.close();
    ws = null;
  }

  return { connect, sendAudio, close };
};
