/**
 * Garanties de securite du service worker.
 *
 * La cle maitresse ne vit qu'en memoire et ne doit jamais sortir de
 * l'extension. content.js etant injecte dans <all_urls>, le service worker
 * doit distinguer ses propres pages d'un content script.
 */
const { PRIVILEGED_ACTIONS, isFromExtensionPage } = require("../background");

describe("cloisonnement des actions sensibles", () => {
  it("protege toutes les actions touchant a la cle ou aux parametres", () => {
    expect([...PRIVILEGED_ACTIONS].sort()).toStrictEqual([
      "checkEncodingKey",
      "clearEncodingKey",
      "getEncodingKey",
      "setEncodingKey",
      "setParams",
    ]);
  });

  it("reconnait un message venant d'une page de l'extension", () => {
    // La popup envoie sans onglet associe.
    expect(isFromExtensionPage({ url: "chrome-extension://abc/popup.html" })).toBe(true);
    expect(isFromExtensionPage(undefined)).toBe(true);
  });

  it("rejette un message venant d'un content script", () => {
    // Un content script porte toujours l'onglet dont il provient.
    expect(isFromExtensionPage({ tab: { id: 42 }, url: "https://evil.example/" })).toBe(false);
    expect(isFromExtensionPage({ tab: { id: 1 }, url: "https://bank.example/login" })).toBe(false);
  });

  it("laisse passer les actions dont content.js a besoin", () => {
    expect(PRIVILEGED_ACTIONS.has("generatePassword")).toBe(false);
    expect(PRIVILEGED_ACTIONS.has("openPopup")).toBe(false);
  });
});

describe("la cle maitresse n'est pas persistee", () => {
  it("n'apparait dans aucune ecriture de storage du service worker", () => {
    const source = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "..", "background.js"),
      "utf8",
    );
    // Les seules ecritures autorisees portent sur les parametres de generation.
    const writes = source.match(/storage\.local\.set\([^)]*\)/g) || [];
    writes.forEach((w) => {
      expect(w).not.toMatch(/encodingKey/);
    });
  });
});
