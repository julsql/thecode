/**
 * Chargement du fond selon le navigateur.
 *
 * Firefox et Safari n'ont pas importScripts dans une page de fond : sans ces
 * fichiers listes dans leur manifeste, loadVault et consorts n'existent pas, et
 * generer echoue avec « loadVault is not defined ».
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

/** Fichiers que background.js tire par importScripts dans un service worker. */
function importedByWorker() {
  const call = read("background.js").match(/importScripts\(([^)]*)\)/)[1];
  return [...call.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("manifeste Firefox / Safari", () => {
  const { background } = JSON.parse(read("manifest-safari-firefox.json"));

  it("charge les dependances du fond avant background.js", () => {
    const scripts = background.scripts;
    const deps = importedByWorker();

    expect(deps.length).toBeGreaterThan(0);
    expect(scripts[scripts.length - 1]).toBe("background.js");
    deps.forEach((dep) => expect(scripts.indexOf(dep)).toBeGreaterThanOrEqual(0));
  });

  it("n'est pas un module : les fichiers doivent partager la portee globale", () => {
    expect(background.type).toBeUndefined();
  });
});
