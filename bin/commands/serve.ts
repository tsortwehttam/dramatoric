import type { CommandModule } from "yargs";

export const serve: CommandModule = {
  command: "serve",
  describe: "Start the WebSocket story server",
  builder: (y) =>
    y.option("port", {
      alias: "p",
      describe: "Port to listen on",
      type: "number",
      default: 8787,
    }),
  handler: async (args) => {
    const argv = args as unknown as { port: number };
    process.env.AUDIO_WS_PORT = String(argv.port);
    await import("../../web/wss.ts");
  },
};
