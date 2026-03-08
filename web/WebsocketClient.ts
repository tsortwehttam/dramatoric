import { StoryEvent, StorySession, StorySources, reifySession } from "../eng/Helpers";
import {
  ManualInputFinal,
  SocketGameBootMessage,
  SocketOutboundMessage,
  decodeSocketOutboundMessage,
} from "../lib/SocketTypings";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type WebsocketClientOptions = {
  url: string;
  onEvent: (event: StoryEvent) => void;
  onError: (error: Error) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onTranscript: (text: string, id: string, final: boolean) => void;
  onSessionSnapshot?: (session: StorySession) => void;
};

type Cartridge = Record<string, string | Buffer>;

type WebSocketLike = {
  onopen: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  send(data: string | ArrayBuffer): void;
  close(): void;
  readyState: number;
};

const CONNECTING = 0;
const OPEN = 1;

function getWebSocketClass(): typeof WebSocket | null {
  if (typeof WebSocket !== "undefined") return WebSocket;
  if (typeof globalThis !== "undefined" && typeof globalThis.WebSocket !== "undefined") {
    return globalThis.WebSocket;
  }
  return null;
}

async function createWebSocket(url: string): Promise<WebSocketLike> {
  const WS = getWebSocketClass();
  if (WS) {
    return new WS(url) as WebSocketLike;
  }
  const { default: NodeWebSocket } = await import("ws");
  return new NodeWebSocket(url) as unknown as WebSocketLike;
}

export function createWebsocketClient(options: WebsocketClientOptions) {
  const { url, onEvent, onError, onStatusChange, onTranscript, onSessionSnapshot } = options;

  let socket: WebSocketLike | null = null;
  let status: ConnectionStatus = "disconnected";

  function setStatus(next: ConnectionStatus) {
    if (status === next) return;
    status = next;
    onStatusChange(next);
  }

  function handleMessage(msg: SocketOutboundMessage) {
    switch (msg.type) {
      case "game_event":
        onEvent(msg.data);
        break;
      case "game_error":
        onError(new Error(msg.message));
        break;
      case "compiler_error":
        onError(new Error(`Compiler error: ${msg.data.name}`));
        break;
      case "transcriber_input_chunk":
        onTranscript(msg.text, msg.id, false);
        break;
      case "transcriber_input_final":
        onTranscript(msg.text, msg.id, true);
        break;
      case "transcriber_error":
        onError(new Error(`Transcriber: ${msg.message}`));
        break;
      case "session_snapshot":
        onSessionSnapshot?.(msg.session);
        break;
      case "transcriber_status":
      case "manual_input_final":
        break;
    }
  }

  function send(data: object) {
    if (!socket || socket.readyState !== OPEN) return;
    socket.send(JSON.stringify(data));
  }

  async function connect(): Promise<void> {
    if (socket && (socket.readyState === CONNECTING || socket.readyState === OPEN)) {
      return;
    }
    setStatus("connecting");
    socket = await createWebSocket(url);
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error("Failed to create socket"));
        return;
      }
      socket.onopen = () => {
        setStatus("connected");
        resolve();
      };
      socket.onclose = () => {
        setStatus("disconnected");
        socket = null;
      };
      socket.onerror = () => {
        setStatus("error");
        reject(new Error("WebSocket error"));
      };
      socket.onmessage = (ev) => {
        const raw = typeof ev.data === "string" ? ev.data : String(ev.data);
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return;
        }
        const result = decodeSocketOutboundMessage(parsed);
        if (result.ok) {
          handleMessage(result.value);
        }
      };
    });
  }

  function boot(cartridge: Cartridge, session: Partial<StorySession> = {}, sources?: StorySources) {
    const msg: SocketGameBootMessage = {
      type: "boot",
      cartridge,
      session: reifySession(session),
      sources,
    };
    send(msg);
  }

  function sendInput(text: string) {
    const msg: ManualInputFinal = { type: "manual_input_final", text };
    send(msg);
  }

  function startTranscriber() {
    send({ type: "transcriber_start" });
  }

  function stopTranscriber() {
    send({ type: "transcriber_stop" });
  }

  function requestSession() {
    send({ type: "get_session" });
  }

  function close() {
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
      socket = null;
    }
    setStatus("disconnected");
  }

  function getStatus(): ConnectionStatus {
    return status;
  }

  return {
    connect,
    boot,
    sendInput,
    startTranscriber,
    stopTranscriber,
    requestSession,
    close,
    getStatus,
  };
}

export type WebsocketClient = ReturnType<typeof createWebsocketClient>;
