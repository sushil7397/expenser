import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves project pages at https://<user>.github.io/<repo>/ so the
// asset URLs need that prefix. Override with VITE_BASE if your repo name changes.
const base = process.env.VITE_BASE || "/expenser/";

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    port: 5173,
    proxy: {
      // During `npm run dev`, forward /api to a local Django on :9099 so you
      // don't hit CORS or HTTPS in development.
      "/api": "http://127.0.0.1:9099",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
