import { defineConfig } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    build: { lib: { entry: resolve(__dirname, "src/main/index.ts") } },
  },
  preload: {
    build: { lib: { entry: resolve(__dirname, "src/preload/index.ts") } },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    plugins: [vue()],
  },
});
