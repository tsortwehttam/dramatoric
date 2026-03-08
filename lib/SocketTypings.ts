import { StoryEvent, StorySession, StorySources } from "../eng/Helpers";
import { err, ErrorBase, isObject, ok, requireBoolean, requireLiteral, requireString, Result } from "./CoreTypings";

export type SocketTranscriberStatus = {
  type: "transcriber_status";
  message: string;
};

export type SocketTranscriberError = {
  type: "transcriber_error";
  message: string;
};

export type SocketTranscriberInputPartial = {
  type: "transcriber_input_chunk";
  id: string;
  text: string;
};

export type SocketTranscriberInputFinal = {
  type: "transcriber_input_final";
  id: string;
  text: string;
};

export type ManualInputFinal = {
  type: "manual_input_final";
  text: string;
};

export type SocketGameEvent = {
  type: "game_event";
  data: StoryEvent;
};

export type SocketCompilerError = {
  type: "compiler_error";
  data: ErrorBase;
};

export type SocketGameError = {
  type: "game_error";
  message: string;
};

export type SocketGameMediaMessage = SocketGameEvent;

export type SocketOutboundMessage =
  | SocketTranscriberStatus
  | SocketTranscriberError
  | SocketTranscriberInputPartial
  | SocketTranscriberInputFinal
  | ManualInputFinal
  | SocketGameEvent
  | SocketGameError
  | SocketCompilerError
  | SocketSessionSnapshot;

export type SocketGameBootMessage = {
  type: "boot";
  cartridge: Record<string, string | Buffer> | undefined;
  sources: StorySources | undefined;
  session: StorySession | undefined;
};

export type SocketTranscriberStart = {
  type: "transcriber_start";
};

export type SocketTranscriberStop = {
  type: "transcriber_stop";
};

export type SocketGetSession = {
  type: "get_session";
};

export type SocketSessionSnapshot = {
  type: "session_snapshot";
  session: StorySession;
};

export type SocketInboundMessage =
  | SocketGameBootMessage
  | SocketTranscriberStart
  | SocketTranscriberStop
  | ManualInputFinal
  | SocketGetSession;

export type SocketRequestEnvelope = {
  seq: string;
  payload: SocketOutboundMessage;
};

export type SocketResponseEnvelope = {
  seq: string;
  payload: SocketInboundMessage;
};

export type TranscriptMessage = {
  id: string;
  text: string;
  final: boolean;
};

function decodeTranscriberStatus(raw: Record<string, unknown>): Result<SocketTranscriberStatus, string> {
  const type = requireLiteral(raw, "type", "transcriber_status");
  if (!type.ok) return type;
  const message = requireString(raw, "message");
  if (!message.ok) return message;
  return ok({ type: "transcriber_status", message: message.value });
}

function decodeTranscriberError(raw: Record<string, unknown>): Result<SocketTranscriberError, string> {
  const type = requireLiteral(raw, "type", "transcriber_error");
  if (!type.ok) return type;
  const message = requireString(raw, "message");
  if (!message.ok) return message;
  return ok({ type: "transcriber_error", message: message.value });
}

function decodeTranscriberInputPartial(raw: Record<string, unknown>): Result<SocketTranscriberInputPartial, string> {
  const type = requireLiteral(raw, "type", "transcriber_input_chunk");
  if (!type.ok) return type;
  const id = requireString(raw, "id");
  if (!id.ok) return id;
  const text = requireString(raw, "text");
  if (!text.ok) return text;
  return ok({
    type: "transcriber_input_chunk",
    id: id.value,
    text: text.value,
  });
}

function decodeTranscriberInputFinal(raw: Record<string, unknown>): Result<SocketTranscriberInputFinal, string> {
  const type = requireLiteral(raw, "type", "transcriber_input_final");
  if (!type.ok) return type;
  const id = requireString(raw, "id");
  if (!id.ok) return id;
  const text = requireString(raw, "text");
  if (!text.ok) return text;
  return ok({
    type: "transcriber_input_final",
    id: id.value,
    text: text.value,
  });
}

function decodeManualInputFinal(raw: Record<string, unknown>): Result<ManualInputFinal, string> {
  const type = requireLiteral(raw, "type", "manual_input_final");
  if (!type.ok) return type;
  const text = requireString(raw, "text");
  if (!text.ok) return text;
  return ok({ type: "manual_input_final", text: text.value });
}

function decodeGameEvent(raw: Record<string, unknown>): Result<SocketGameEvent, string> {
  const type = requireLiteral(raw, "type", "game_event");
  if (!type.ok) return type;
  const data = raw.data as StoryEvent;
  return ok({ type: "game_event", data });
}

function decodeGameError(raw: Record<string, unknown>): Result<SocketGameError, string> {
  const type = requireLiteral(raw, "type", "game_error");
  if (!type.ok) return type;
  const message = requireString(raw, "message");
  if (!message.ok) return message;
  return ok({ type: "game_error", message: message.value });
}

export function decodeSocketOutboundMessage(raw: unknown): Result<SocketOutboundMessage, string> {
  if (!isObject(raw)) {
    return err("expected object");
  }
  const type = raw.type;
  if (typeof type !== "string") {
    return err("missing or invalid 'type' field");
  }
  switch (type) {
    case "transcriber_status":
      return decodeTranscriberStatus(raw);
    case "transcriber_error":
      return decodeTranscriberError(raw);
    case "transcriber_input_chunk":
      return decodeTranscriberInputPartial(raw);
    case "transcriber_input_final":
      return decodeTranscriberInputFinal(raw);
    case "manual_input_final":
      return decodeManualInputFinal(raw);
    case "game_event":
      return decodeGameEvent(raw);
    case "game_error":
      return decodeGameError(raw);
    case "session_snapshot":
      return ok({ type: "session_snapshot", session: raw.session } as SocketSessionSnapshot);
    default:
      return err(`unknown outbound message type: ${type}`);
  }
}

function decodeGameBoot(raw: Record<string, unknown>): Result<SocketGameBootMessage, string> {
  const type = requireLiteral(raw, "type", "boot");
  if (!type.ok) return type;
  const cartridge = raw.cartridge as Record<string, string> | undefined;
  const sources = raw.sources as StorySources | undefined;
  const session = raw.session as StorySession | undefined;
  return ok({ type: "boot", cartridge, sources, session });
}

function decodeTranscriberStart(raw: Record<string, unknown>): Result<SocketTranscriberStart, string> {
  const type = requireLiteral(raw, "type", "transcriber_start");
  if (!type.ok) return type;
  return ok({ type: "transcriber_start" });
}

function decodeTranscriberStop(raw: Record<string, unknown>): Result<SocketTranscriberStop, string> {
  const type = requireLiteral(raw, "type", "transcriber_stop");
  if (!type.ok) return type;
  return ok({ type: "transcriber_stop" });
}

export function decodeSocketInboundMessage(raw: unknown): Result<SocketInboundMessage, string> {
  if (!isObject(raw)) {
    return err("expected object");
  }
  const type = raw.type;
  if (typeof type !== "string") {
    return err("missing or invalid 'type' field");
  }
  switch (type) {
    case "boot":
      return decodeGameBoot(raw);
    case "transcriber_start":
      return decodeTranscriberStart(raw);
    case "transcriber_stop":
      return decodeTranscriberStop(raw);
    case "manual_input_final":
      return decodeManualInputFinal(raw);
    case "get_session":
      return ok({ type: "get_session" } as SocketGetSession);
    default:
      return err(`unknown inbound message type: ${type}`);
  }
}

export function decodeSocketRequestEnvelope(raw: unknown): Result<SocketRequestEnvelope, string> {
  if (!isObject(raw)) {
    return err("expected object");
  }
  const seq = requireString(raw, "seq");
  if (!seq.ok) return seq;
  const payload = decodeSocketOutboundMessage(raw.payload);
  if (!payload.ok) return err(`payload: ${payload.error}`);
  return ok({ seq: seq.value, payload: payload.value });
}

export function decodeSocketResponseEnvelope(raw: unknown): Result<SocketResponseEnvelope, string> {
  if (!isObject(raw)) {
    return err("expected object");
  }
  const seq = requireString(raw, "seq");
  if (!seq.ok) return seq;
  const payload = decodeSocketInboundMessage(raw.payload);
  if (!payload.ok) return err(`payload: ${payload.error}`);
  return ok({ seq: seq.value, payload: payload.value });
}

export function decodeTranscriptMessage(raw: unknown): Result<TranscriptMessage, string> {
  if (!isObject(raw)) {
    return err("expected object");
  }
  const id = requireString(raw, "id");
  if (!id.ok) return id;
  const text = requireString(raw, "text");
  if (!text.ok) return text;
  const final = requireBoolean(raw, "final");
  if (!final.ok) return final;
  return ok({ id: id.value, text: text.value, final: final.value });
}
