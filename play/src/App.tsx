import { StorySession } from "eng/Helpers.ts";
import { useEffect, useState } from "react";
import { Loader } from "./Loader.tsx";
import { Stage } from "./Stage.tsx";
import { useSocket } from "./useSocket.ts";

type Screen = "loader" | "stage";

type BootPayload = {
  cartridge: Record<string, string>;
  session: Partial<StorySession> | undefined;
};

export function App() {
  const socket = useSocket();
  const [screen, setScreen] = useState<Screen>("loader");

  useEffect(() => {
    if (!socket.connected) return;
    fetch("/_preloaded.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const payload = data as { cartridge: Record<string, string>; session?: Partial<StorySession> };
        socket.boot(payload.cartridge, payload.session);
        setScreen("stage");
      })
      .catch(() => {});
  }, [socket.connected]);

  function handleBoot(payload: BootPayload) {
    socket.boot(payload.cartridge, payload.session);
    setScreen("stage");
  }

  function handleBack() {
    setScreen("loader");
  }

  if (screen === "loader") {
    return <Loader connected={socket.connected} onBoot={handleBoot} />;
  }

  return <Stage socket={socket} onBack={handleBack} />;
}
