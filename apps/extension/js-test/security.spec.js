/**
 * Garanties de securite du service worker.
 *
 * La cle maitresse ne vit qu'en memoire et ne doit jamais sortir de
 * l'extension. content.js etant injecte dans <all_urls>, le service worker
 * doit distinguer ses propres pages d'un content script.
 */
const EXTENSION_ORIGIN = "chrome-extension://abcdefghijklmnop/";
global.chrome = {
  runtime: {
    getURL: (path) => EXTENSION_ORIGIN + path,
    onMessage: { addListener: () => {} },
  },
  storage: {
    local: { get: async () => ({}), set: async () => {}, remove: async () => {} },
    onChanged: { addListener: () => {} },
  },
};
global.browser = global.chrome;

const { PRIVILEGED_ACTIONS, isFromExtensionPage } = require("../background");

describe("cloisonnement des actions sensibles", () => {
  it("protege toutes les actions touchant a la cle ou aux parametres", () => {
    // Liste figee volontairement : ajouter une action sensible doit etre un
    // geste conscient, pas un effet de bord.
    expect([...PRIVILEGED_ACTIONS].sort()).toStrictEqual([
      // Derivent ou ecrivent un mot de passe deja en service.
      "applyChange",
      "checkEncodingKey",
      "clearEncodingKey",
      "deleteEntry",
      // Chiffrent ou fusionnent le carnet entier.
      "exportVault",
      "getEncodingKey",
      // Liste les sites et identifiants : reserve aux pages de l'extension.
      "getVault",
      "importVault",
      "previewChange",
      "saveSite",
      "setEncodingKey",
      "setParams",
      // Lance une synchronisation : une page web n'a pas a la provoquer.
      "syncAutoOpen",
      // Ouvre une fenetre Google et ecrit la session de synchronisation.
      "syncGoogleAvailable",
      "syncGoogleLogin",
      "syncLogin",
      "syncLogout",
      "syncNow",
      "syncStatus",
      // Verrou de l'ecran carnet : l'oubli efface le carnet.
      "vaultLockChange",
      "vaultLockCreate",
      "vaultLockForget",
      "vaultLockStatus",
      "vaultLockVerify",
      // Grace de 3 minutes : rouvrirait l'ecran carnet sans mot de passe.
      "vaultSessionClear",
      "vaultSessionLeave",
      "vaultSessionResume",
    ]);
  });

  it("reconnait un message venant d'une page de l'extension", () => {
    // La popup envoie sans onglet associe.
    expect(isFromExtensionPage({ url: `${EXTENSION_ORIGIN}popup.html` })).toBe(true);
    expect(isFromExtensionPage(undefined)).toBe(true);
  });

  it("accepte une page de l'extension ouverte dans un onglet", () => {
    // Quand browser.action.openPopup() n'existe pas — Firefox pour Android,
    // Safari — la popup s'ouvre dans un onglet. Elle reste une page de
    // l'extension, et doit pouvoir enregistrer la clef.
    expect(isFromExtensionPage({ tab: { id: 3 }, url: `${EXTENSION_ORIGIN}popup.html` })).toBe(
      true,
    );
  });

  it("rejette un message venant d'un content script", () => {
    // Un content script porte toujours l'onglet dont il provient.
    expect(isFromExtensionPage({ tab: { id: 42 }, url: "https://evil.example/" })).toBe(false);
    expect(isFromExtensionPage({ tab: { id: 1 }, url: "https://bank.example/login" })).toBe(false);
  });

  it("protege l'ecriture du carnet et sa lecture", () => {
    // Une page ne doit jamais pouvoir creer ni supprimer une entree, sinon
    // elle pourrait detourner un mot de passe en reecrivant le siteKey. Ni lire
    // le carnet : il revele tous les sites et identifiants de l'utilisateur.
    expect(PRIVILEGED_ACTIONS.has("saveSite")).toBe(true);
    expect(PRIVILEGED_ACTIONS.has("deleteEntry")).toBe(true);
    expect(PRIVILEGED_ACTIONS.has("getVault")).toBe(true);
  });

  it("protege la synchronisation", () => {
    // syncNow derive avec la clef maitresse et parle au serveur : une page web
    // ne doit pas pouvoir la declencher, ni lire l'etat de la session.
    for (const action of ["syncLogin", "syncLogout", "syncNow", "syncStatus"]) {
      expect(PRIVILEGED_ACTIONS.has(action)).toBe(true);
    }
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
