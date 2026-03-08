import { StoryEvent, StorySession } from "eng/Helpers.ts";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useSocket } from "./useSocket.ts";

const SPEAKER_COLORS = ["#6ec6ff", "#ffa726", "#ce93d8", "#81c784", "#ef5350", "#ffee58", "#4dd0e1", "#ff8a65"];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return SPEAKER_COLORS[Math.abs(h) % SPEAKER_COLORS.length];
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  socket: ReturnType<typeof useSocket>;
  onBack: () => void;
};

function EventLine({ event }: { event: StoryEvent }) {
  if (event.type === "$exit") {
    return <div className="event exit">Story ended.</div>;
  }
  if (event.channel === "input") {
    return (
      <div className="event input">
        <span className="speaker" style={{ color: "#aaa" }}>
          YOU:
        </span>{" "}
        {event.value}
      </div>
    );
  }
  if (event.type === "$media") {
    return (
      <div className="event media">
        <span className="speaker" style={{ color: colorFor(event.from) }}>
          {event.from}:
        </span>{" "}
        <span className="dim">[{event.act}]</span> {event.value}
        {event.url && (
          <span className="dim">
            {" "}
            <a href={event.url} target="_blank" rel="noreferrer">
              [audio]
            </a>
          </span>
        )}
      </div>
    );
  }
  if (event.type === "$message") {
    return (
      <div className="event message">
        <span className="speaker" style={{ color: colorFor(event.from) }}>
          {event.from}:
        </span>{" "}
        {event.value}
      </div>
    );
  }
  return (
    <div className="event other">
      <span className="dim">
        [{event.type}] {event.value}
      </span>
    </div>
  );
}

export function Stage({ socket, onBack }: Props) {
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [socket.events.length]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;
    socket.sendInput(val);
    setInput("");
  }

  function handleRecord() {
    if (recording) {
      socket.stopTranscriber();
      setRecording(false);
    } else {
      socket.startTranscriber();
      setRecording(true);
    }
  }

  function handleSave() {
    socket.requestSession((session: StorySession) => {
      downloadJson(session, `aramatoric-session-${Date.now()}.json`);
    });
  }

  return (
    <div className="stage">
      <div className="stage-header">
        <button className="btn small" onClick={onBack}>
          Back
        </button>
        <span className="stage-title">Dramatoric Player</span>
        <button className="btn small" onClick={handleSave}>
          Save Session
        </button>
      </div>

      <div className="stage-log" ref={logRef}>
        {socket.events.map((ev, i) => (
          <EventLine key={i} event={ev} />
        ))}
        {socket.errors.map((err, i) => (
          <div key={`err-${i}`} className="event error">
            {err}
          </div>
        ))}
        {socket.transcript && <div className="event transcript dim">{socket.transcript}...</div>}
      </div>

      <form className="stage-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={socket.exited ? "Story has ended" : "Type your response..."}
          disabled={socket.exited}
          autoFocus
        />
        <button type="submit" className="btn primary" disabled={socket.exited || !input.trim()}>
          Send
        </button>
        <button
          type="button"
          className={`btn ${recording ? "recording" : "secondary"}`}
          onClick={handleRecord}
          disabled={socket.exited}
        >
          {recording ? "Stop" : "Mic"}
        </button>
      </form>
    </div>
  );
}
