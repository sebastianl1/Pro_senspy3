import { defineConfig } from "vite";
import path from "path";

// Sirve la carpeta SCADA tal cual (HTML + CSS + JS estáticos).
export default defineConfig({
  root: path.resolve(__dirname, "SCADA"),
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    fs: { allow: [path.resolve(__dirname)] },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
