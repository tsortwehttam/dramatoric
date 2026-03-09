import { StorySession } from "eng/Helpers";
import { unzipSync } from "fflate";
import { useRef, useState } from "react";

type Props = {
  connected: boolean;
  onBoot: (payload: { cartridge: Record<string, string>; session: Partial<StorySession> | undefined }) => void;
};

export function Loader({ connected, onBoot }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Record<string, string>>({});
  const [session, setSession] = useState<Partial<StorySession> | undefined>(undefined);
  const [sessionName, setSessionName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".zip")) {
      file.arrayBuffer().then((buf) => {
        const extracted = unzipSync(new Uint8Array(buf));
        const cart: Record<string, string> = {};
        for (const [name, data] of Object.entries(extracted)) {
          if (
            name.endsWith(".dram") ||
            name.endsWith(".json") ||
            name.endsWith(".yaml") ||
            name.endsWith(".yml")
          ) {
            cart[name] = new TextDecoder().decode(data);
          }
        }
        setFiles(cart);
        setText("");
      });
      return;
    }

    file.text().then((content) => {
      const name = file.name.endsWith(".dram") ? file.name : "main.dram";
      setFiles({ [name]: content });
      setText("");
    });
  }

  function handleSession(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((content) => {
      setSession(JSON.parse(content) as Partial<StorySession>);
      setSessionName(file.name);
    });
  }

  function handlePlay() {
    let cartridge: Record<string, string>;
    if (Object.keys(files).length > 0) {
      cartridge = files;
    } else if (text.trim()) {
      cartridge = { "main.dram": text };
    } else {
      return;
    }
    onBoot({ cartridge, session });
  }

  const hasContent = Object.keys(files).length > 0 || text.trim().length > 0;
  const fileNames = Object.keys(files);

  return (
    <div className="loader">
      <div className="loader-card">
        <h1>Dramatoric Player</h1>
        <p className="dim">Load a story to begin</p>

        <div className="loader-status">
          <span className={connected ? "dot green" : "dot red"} />
          {connected ? "Connected" : "Connecting..."}
        </div>

        <div className="loader-section">
          <label>Paste story text</label>
          <textarea
            rows={10}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFiles({});
            }}
            placeholder={"NARRATOR:\nOnce upon a time..."}
            spellCheck={false}
          />
        </div>

        <div className="loader-divider">or</div>

        <div className="loader-section">
          <label>Upload file</label>
          <button className="btn secondary" onClick={() => fileRef.current?.click()}>
            Choose .dram or .zip
          </button>
          <input ref={fileRef} type="file" accept=".dram,.zip,.txt" onChange={handleFile} hidden />
          {fileNames.length > 0 && <p className="dim small">{fileNames.join(", ")}</p>}
        </div>

        <div className="loader-section">
          <label>Load session (optional)</label>
          <button className="btn secondary" onClick={() => sessionRef.current?.click()}>
            Choose session .json
          </button>
          <input ref={sessionRef} type="file" accept=".json" onChange={handleSession} hidden />
          {sessionName && <p className="dim small">{sessionName}</p>}
        </div>

        <button className="btn primary" onClick={handlePlay} disabled={!connected || !hasContent}>
          Play
        </button>
      </div>
    </div>
  );
}
