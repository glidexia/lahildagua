import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const buildId = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VITE_APP_BUILD_ID || Date.now().toString();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  build: {
    rollupOptions: {
      plugins: [{
        name: "emit-app-version",
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "version.json",
            source: JSON.stringify({ buildId }),
          });
        },
      }],
    },
  },
});
