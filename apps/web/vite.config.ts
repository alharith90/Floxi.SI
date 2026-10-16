import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  root: "apps/web",
  plugins: [react(), tailwind()],
  server: {
    strictPort: true,
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/socket.io": { target: "http://127.0.0.1:3001", ws: true },
    },
  },
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/zod/")) return "validation";
          if (
            [
              "/node_modules/react/",
              "/node_modules/react-dom/",
              "/node_modules/scheduler/",
            ].some((name) => id.includes(name))
          )
            return "react-runtime";
        },
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/socket.io": { target: "http://127.0.0.1:3001", ws: true },
    },
  },
});
