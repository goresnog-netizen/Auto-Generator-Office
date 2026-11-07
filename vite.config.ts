import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, type Plugin } from "vite";

/**
 * Middleware API DeckCraft untuk dev server Vite.
 * Rute `/api/deckcraft/*` ditangani di luar bundel browser karena memakai
 * `child_process` dan `node:fs`.
 *
 * Modul diimpor secara dinamis + aman, karena file ini juga dipakai di
 * mirror `Deploy Github/` yang做的就是 ke Vercel. Di mirror itu folder
 * `server/` tidak ada (Vercel melayani aplikasi statis), jadi import statis
 * akan menggagalkan build dengan "cannot find module".
 *
 * Kalau modul tak ada, middleware dilewati: sisanya aplikasi tetap jalan,
 * dan panel DeckCraft Studio menampilkan pesan yang tepat ("Server ini tidak
 * menyediakan API DeckCraft") karena rute API jatuh ke halaman HTML.
 */
async function muatApiDeckcraft(): Promise<Plugin | null> {
  try {
    const modul = await import("./server/deckcraft-api.ts");
    return {
      name: "nitz-deckcraft-api",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          void modul.tanganiApi(req, res).then((tertangani) => {
            if (!tertangani) next();
          });
        });
      },
    };
  } catch {
    return null;
  }
}

export default defineConfig(async () => {
  const api = await muatApiDeckcraft();
  return {
    // Aset relatif: hasil build bisa dibuka dari subdirektori mana pun
    // (GitHub Pages /Auto-Generator-Office/, Vercel, atau folder lokal).
    // Tanpa ini, Vite menulis "/assets/…" yang putus di Pages project site.
    base: "./",
    plugins: api ? [react(), api] : [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      open: false,
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("pptxgenjs")) return "pptxgenjs";
              if (id.includes("docx")) return "docx";
              if (id.includes("exceljs")) return "exceljs";
              if (id.includes("mermaid")) return "mermaid";
              if (id.includes("d3")) return "d3";
            }
          },
        },
      },
    },
    test: {
      // `Deploy Github/` adalah salinan mirror untuk hosting statis. Berkas
      // ujinya identik dengan yang di `src/`, jadi tanpa pengecualian ini
      // vitest menjalankan setiap tes dua kali dan jumlah tesnya menipu.
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/Deploy Github/**",
      ],
    },
  };
});
