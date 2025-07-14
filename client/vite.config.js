import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      "40aecaa609b7.ngrok-free.app",
      "c9f9a38b4c64.ngrok-free.app",
    ],
  },
  base: "/simple-peer/",
});
