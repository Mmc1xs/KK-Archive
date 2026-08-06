import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/tool-static/PluginDataReaderVue/",
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [vue()],
  build: {
    outDir: fileURLToPath(new URL("../../public/tool-static/PluginDataReaderVue", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false
  }
});
