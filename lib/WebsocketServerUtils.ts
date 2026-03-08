import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { sleep } from "./AsyncHelpers";
import {
  SocketInboundMessage,
  SocketOutboundMessage,
  SocketRequestEnvelope,
  SocketResponseEnvelope,
} from "./SocketTypings";

const SOCKET_REPLY_TIMEOUT_MS = 10000;

export function sendJson(
  socket: WebSocket,
  payload: SocketOutboundMessage
): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }
  console.info("[wss] send payload", payload.type, payload);
  socket.send(JSON.stringify(payload));
}

export async function sendJsonAndAwaitReply(
  socket: WebSocket,
  payload: SocketOutboundMessage
): Promise<SocketInboundMessage> {
  if (socket.readyState !== WebSocket.OPEN) {
    throw new Error("socket unavailable");
  }
  const seq = randomUUID();
  const envelope: SocketRequestEnvelope = {
    seq,
    payload,
  };
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    addPendingRequest(socket, seq, {
      resolve: function (message) {
        controller.abort();
        resolve(message);
      },
      reject: function (error) {
        controller.abort();
        reject(error);
      },
    });
    sleep(SOCKET_REPLY_TIMEOUT_MS, controller.signal).then(function () {
      if (controller.signal.aborted) {
        return;
      }
      rejectPendingRequest(socket, seq, new Error("socket reply timeout"));
    });
    socket.send(JSON.stringify(envelope));
  });
}

export function registerSocketResponse(
  socket: WebSocket,
  payload: SocketResponseEnvelope
): boolean {
  return fulfillPendingRequest(socket, payload.seq, payload.payload);
}

export function rejectAllPendingRequests(
  socket: WebSocket,
  error: Error
): void {
  const queue = pendingRequests.get(socket);
  if (!queue) {
    return;
  }
  pendingRequests.delete(socket);
  queue.forEach(function (entry) {
    entry.reject(error);
  });
}

type PendingRequest = {
  resolve: (message: SocketInboundMessage) => void;
  reject: (error: Error) => void;
};

const pendingRequests = new WeakMap<WebSocket, Map<string, PendingRequest>>();

function addPendingRequest(
  socket: WebSocket,
  seq: string,
  entry: PendingRequest
): void {
  let queue = pendingRequests.get(socket);
  if (!queue) {
    queue = new Map();
    pendingRequests.set(socket, queue);
  }
  queue.set(seq, entry);
}

function takePendingRequest(
  socket: WebSocket,
  seq: string
): PendingRequest | null {
  const queue = pendingRequests.get(socket);
  if (!queue) {
    return null;
  }
  const entry = queue.get(seq) ?? null;
  if (!entry) {
    return null;
  }
  queue.delete(seq);
  if (queue.size === 0) {
    pendingRequests.delete(socket);
  }
  return entry;
}

function fulfillPendingRequest(
  socket: WebSocket,
  seq: string,
  payload: SocketInboundMessage
): boolean {
  const entry = takePendingRequest(socket, seq);
  if (!entry) {
    return false;
  }
  entry.resolve(payload);
  return true;
}

function rejectPendingRequest(
  socket: WebSocket,
  seq: string,
  error: Error
): boolean {
  const entry = takePendingRequest(socket, seq);
  if (!entry) {
    return false;
  }
  entry.reject(error);
  return true;
}
