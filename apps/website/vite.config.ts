import { defineConfig } from "vite";
import type { Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "node:fs";
import path from "path";
import { prerenderTargets, renderPageHtml } from "./src/seoMeta";

/**
 * La SPA n'a qu'un index.html : sans ce plugin, chaque URL servirait les
 * métadonnées de l'accueil aux robots qui n'exécutent pas le JavaScript.
 * L'accueil anglais va dans index.html (fallback nginx), puis chaque page
 * publique reçoit son propre <lang>/<page>/index.html.
 */
function seoPages(): Plugin {
  let outDir = "dist";
  return {
    name: "thecode-seo-pages",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      const indexFile = path.join(outDir, "index.html");
      const template = fs.readFileSync(indexFile, "utf8");
      fs.writeFileSync(indexFile, renderPageHtml(template, "en", ""));
      for (const { lang, page, file } of prerenderTargets()) {
        const target = path.join(outDir, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, renderPageHtml(template, lang, page));
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), seoPages()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
