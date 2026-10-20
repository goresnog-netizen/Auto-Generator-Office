import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, type Plugin } from "vite";
import { tanganiApi } from "./server/deckcraft-api.ts";

/**
 * Middleware API DeckCraft untuk dev server Vite.
 * Rute `/api/deckcraft/*` ditangani di luar bundel browser karena memakai
 * `child_process` dan `node:fs`.
 */
function deckcraftApi(): Plugin {
  return {
    name: "nitz-deckcraft-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void tanganiApi(req, res).then((tertangani) => {
          if (!tertangani) next();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), deckcraftApi()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    open: false,
  },
});
