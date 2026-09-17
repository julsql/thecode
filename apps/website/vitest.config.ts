import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// Configuration propre aux tests : les tests de composants ont besoin d'un DOM,
// que la config de build (vite.config.ts) n'a pas a fournir.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: false,
  },
});
