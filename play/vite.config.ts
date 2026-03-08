import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      web: path.resolve(__dirname, "../web"),
      eng: path.resolve(__dirname, "../eng"),
      lib: path.resolve(__dirname, "../lib"),
    },
  },
  server: {
    port: 5199,
    open: true,
  },
});
