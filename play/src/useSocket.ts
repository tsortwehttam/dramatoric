import { StoryEvent, StorySession } from "eng/Helpers";
import { useCallback, useEffect, useRef, useState } from "react";
import { createWebsocketClient, WebsocketClient } from "web/WebsocketClient.ts";

type SocketState = {
  connected: boolean;
  events: StoryEvent[];
  errors: string[];
  transcript: string;
  exited: boolean;
};

type SessionCallback = (session: StorySession) => void;

const WS_URL = "ws://localhost:8787";

export function useSocket() {
  const ref = useRef<WebsocketClient | null>(null);
  const snapshotCb = useRef<SessionCallback | null>(null);
  const [state, setState] = useState<SocketState>({
    connected: false,
    events: [],
    errors: [],
    transcript: "",
    exited: false,
  });

  useEffect(() => {
    const client = createWebsocketClient({
      url: WS_URL,
      onEvent(event: StoryEvent) {
        setState((s) => ({
          ...s,
          events: [...s.events, event],
          exited: event.type === "$exit" ? true : s.exited,
        }));
      },
      onError(error: Error) {
        setState((s) => ({ ...s, errors: [...s.errors, error.message] }));
      },
      onStatusChange(status) {
        setState((s) => ({ ...s, connected: status === "connected" }));
      },
      onTranscript(text: string, _id: string, final: boolean) {
        if (!final) {
          setState((s) => ({ ...s, transcript: text }));
        } else {
          setState((s) => ({ ...s, transcript: "" }));
        }
      },
      onSessionSnapshot(session: StorySession) {
        snapshotCb.current?.(session);
        snapshotCb.current = null;
      },
    });
    ref.current = client;
    client.connect();
    return () => {
      client.close();
      ref.current = null;
    };
  }, []);

  const boot = useCallback((cartridge: Record<string, string>, session?: Partial<StorySession>) => {
    setState((s) => ({ ...s, events: [], errors: [], exited: false }));
    ref.current?.boot(cartridge, session ?? {});
  }, []);

  const sendInput = useCallback((text: string) => {
    ref.current?.sendInput(text);
  }, []);

  const requestSession = useCallback((cb: SessionCallback) => {
    snapshotCb.current = cb;
    ref.current?.requestSession();
  }, []);

  const startTranscriber = useCallback(() => {
    ref.current?.startTranscriber();
  }, []);

  const stopTranscriber = useCallback(() => {
    ref.current?.stopTranscriber();
  }, []);

  return { ...state, boot, sendInput, requestSession, startTranscriber, stopTranscriber };
}
