import { err, ok, Result } from "./CoreTypings";
import {
  decodeSocketOutboundMessage,
  decodeSocketRequestEnvelope,
  SocketInboundMessage,
  SocketOutboundMessage,
} from "./SocketTypings";

const SOCKET_OPEN_STATE = 1;

type SocketSender = {
  readyState: number;
  send: (data: string) => void;
} | null;

export type ParsedSocketMessage = {
  seq: string | null;
  message: SocketOutboundMessage;
};

export type ParseSocketResult = Result<ParsedSocketMessage, string>;

export function tryParseSocketMessage(data: string): ParseSocketResult {
  const trimmed = data.trim();
  if (!trimmed.startsWith("{")) {
    return err("not a JSON object");
  }
  const raw = JSON.parse(trimmed);
  const envelope = decodeSocketRequestEnvelope(raw);
  if (envelope.ok) {
    return ok({ seq: envelope.value.seq, message: envelope.value.payload });
  }
  const message = decodeSocketOutboundMessage(raw);
  if (message.ok) {
    return ok({ seq: null, message: message.value });
  }
  return err(message.error);
}

export function sendSocketMessage(
  socket: SocketSender,
  payload: SocketInboundMessage
): void {
  if (!socket || socket.readyState !== SOCKET_OPEN_STATE) {
    return;
  }
  socket.send(JSON.stringify(payload));
}
