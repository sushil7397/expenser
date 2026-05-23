import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves project pages at https://<user>.github.io/<repo>/ so the
// asset URLs need that prefix. Override with VITE_BASE if your repo name changes.
const base = process.env.VITE_BASE || "/expenser/";

export default defineConfig({
  plugins: [react()],
  base,
  server: { port: 5173 },
  build: { outDir: "dist", sourcemap: false },
});
