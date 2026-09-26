/**
 * Tests d'integration du protocole de messages du service worker.
 *
 * Les tests unitaires couvrent l'algorithme, les e2e couvrent le navigateur.
 * Entre les deux, c'est ici que se joue le cablage : quelle action repond quoi,
 * qui a le droit de la demander, et ce qui arrive quand la cle est absente.
 */
const path = require("node:path");

/** Recharge background.js avec un environnement navigateur simule. */
function loadWorker({ storage = {} } = {}) {
  const store = { ...storage };
  const listeners = [];

  global.chrome = {
    runtime: {
      getURL: (p) => `data:text/plain,${p}`,
      onMessage: { addListener: (fn) => listeners.push(fn) },
    },
    storage: {
      local: {
        get: async (keys) =>
          Object.fromEntries(
            (Array.isArray(keys) ? keys : [keys])
              .filter((k) => k in store)
              .map((k) => [k, store[k]]),
          ),
        set: async (obj) => Object.assign(store, obj),
        remove: async (keys) =>
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]),
      },
      onChanged: { addListener: () => {} },
    },
  };
  global.browser = global.chrome;

  // jest tient son propre registre de modules : require.cache n'a aucun effet,
  // et sans reset le service worker n'enregistrerait son listener qu'une fois.
  jest.resetModules();
  require(path.join(__dirname, "..", "background.js"));

  /** Envoie un message comme le ferait la popup ou un content script. */
  const send = (request, sender = {}) =>
    new Promise((resolve) => {
      listeners[0](request, sender, resolve);
    });

  return { send, store };
}

const FROM_POPUP = {};
const FROM_CONTENT_SCRIPT = { tab: { id: 7 }, url: "https://example.com/" };

describe("protocole de messages", () => {
  it("repond une erreur explicite a une action inconnue", async () => {
    const { send } = loadWorker();
    expect(await send({ action: "n-importe-quoi" })).toStrictEqual({ error: "action inconnue" });
  });

  it("signale l'absence de cle plutot que de generer quoi que ce soit", async () => {
    const { send } = loadWorker();
    const res = await send({ action: "generatePassword", url: "https://google.com/" });
    expect(res.error).toMatch(/cl[ée]/i);
    expect(res.password).toBeUndefined();
  });

  it("indique si une cle est definie", async () => {
    const { send } = loadWorker();
    expect(await send({ action: "checkEncodingKey" }, FROM_POPUP)).toStrictEqual({
      hasEncodingKey: false,
    });
    await send({ action: "setEncodingKey", encodingKey: "clef" }, FROM_POPUP);
    expect(await send({ action: "checkEncodingKey" }, FROM_POPUP)).toStrictEqual({
      hasEncodingKey: true,
    });
  });

  it("efface la cle sur demande", async () => {
    const { send } = loadWorker();
    await send({ action: "setEncodingKey", encodingKey: "clef" }, FROM_POPUP);
    await send({ action: "clearEncodingKey" }, FROM_POPUP);
    expect(await send({ action: "checkEncodingKey" }, FROM_POPUP)).toStrictEqual({
      hasEncodingKey: false,
    });
  });
});

describe("cloisonnement vis-a-vis des content scripts", () => {
  it("refuse de livrer la cle a un content script", async () => {
    const { send } = loadWorker();
    await send({ action: "setEncodingKey", encodingKey: "secret" }, FROM_POPUP);

    const res = await send({ action: "getEncodingKey" }, FROM_CONTENT_SCRIPT);
    expect(res.encodingKey).toBeUndefined();
    expect(res.error).toBeDefined();
  });

  it("refuse de livrer le carnet a un content script", async () => {
    const vault = {
      schema: 1,
      updatedAt: "2026-01-01T00:00:00Z",
      entries: [
        {
          id: "a",
          label: "bank.example",
          siteKey: "bank.example",
          domains: ["bank.example"],
          login: "moi@example.com",
          counter: 1,
          length: 20,
          charset: { lower: true, upper: true, symbols: true, numbers: true },
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    };
    const { send } = loadWorker({ storage: { vault } });

    const denied = await send({ action: "getVault" }, FROM_CONTENT_SCRIPT);
    expect(denied.vault).toBeUndefined();
    expect(denied.error).toBeDefined();

    const allowed = await send({ action: "getVault" }, FROM_POPUP);
    expect(allowed.vault.entries.map((e) => e.login)).toStrictEqual(["moi@example.com"]);
  });

  it("la livre a la popup", async () => {
    const { send } = loadWorker();
    await send({ action: "setEncodingKey", encodingKey: "secret" }, FROM_POPUP);
    expect(await send({ action: "getEncodingKey" }, FROM_POPUP)).toStrictEqual({
      encodingKey: "secret",
    });
  });

  it("refuse qu'un content script change les parametres", async () => {
    const { send } = loadWorker();
    const res = await send({ action: "setParams", data: { lengthNumber: 4 } }, FROM_CONTENT_SCRIPT);
    expect(res.error).toBeDefined();
    expect(res.ok).toBeUndefined();
  });

  it("laisse un content script demander un mot de passe", async () => {
    const { send } = loadWorker();
    await send({ action: "setEncodingKey", encodingKey: "clef" }, FROM_POPUP);

    const res = await send(
      { action: "generatePassword", url: "https://google.com/" },
      FROM_CONTENT_SCRIPT,
    );
    expect(res.error).toBeUndefined();
    expect(typeof res.password).toBe("string");
    expect(res.password.length).toBe(20);
  });
});

describe("persistance des parametres", () => {
  it("borne une longueur hors limites avant de l'enregistrer", async () => {
    const { send, store } = loadWorker();
    const res = await send({ action: "setParams", data: { lengthNumber: 999 } }, FROM_POPUP);
    expect(res.ok).toBe(true);
    expect(res.params.lengthNumber).toBe(40);
    expect(store.lengthNumber).toBe(40);
  });

  it("relit ce qui a ete enregistre", async () => {
    const { send } = loadWorker({ storage: { lengthNumber: 30, symState: false } });
    const res = await send({ action: "getParams" }, FROM_POPUP);
    expect(res.params.lengthNumber).toBe(30);
    expect(res.params.symState).toBe(false);
  });

  it("n'ecrit jamais la cle dans le stockage", async () => {
    const { send, store } = loadWorker();
    await send({ action: "setEncodingKey", encodingKey: "tres-secret" }, FROM_POPUP);
    await send({ action: "setParams", data: { lengthNumber: 24 } }, FROM_POPUP);
    expect(JSON.stringify(store)).not.toContain("tres-secret");
  });
});

/**
 * Le compteur — renouveler un mot de passe sans changer de clef maitresse —
 * fait partie de l'offre payante.
 *
 * La verification vit dans le service worker et pas seulement dans la popup :
 * c'est ici que le compteur s'ecrit. Et elle vit sur l'appareil parce qu'elle
 * ne peut pas vivre ailleurs : le compteur voyage dans le bloc chiffre, le
 * serveur ne le voit pas.
 */
describe("renouvellement reserve a l'offre complete", () => {
  const ENTRY = {
    id: "e1",
    siteKey: "example.com",
    domains: ["example.com"],
    login: "",
    length: 20,
    charset: "luds",
    counter: 1,
    updatedAt: "2026-09-01T10:00:00Z",
  };

  // Copie : un test qui renouvelle ne doit pas modifier ENTRY pour les suivants.
  const vaultWith = (entry) => ({
    schema: 1,
    updatedAt: "2026-09-01T10:00:00Z",
    entries: [{ ...entry }],
  });

  const session = (plan) => ({
    endpoint: "https://exemple.test",
    accessToken: "jeton",
    refreshToken: "renouvellement",
    plan,
  });

  it("refuse d'incrementer le compteur sans offre complete", async () => {
    const { send, store } = loadWorker({
      storage: { vault: vaultWith(ENTRY), syncSession: session("free") },
    });
    await send({ action: "setEncodingKey", encodingKey: "clef" }, FROM_POPUP);

    const response = await send({ action: "applyChange", id: "e1", renew: true }, FROM_POPUP);

    expect(response.ok).toBe(false);
    expect(response.error).toContain("offre complete");
    expect(store.vault.entries[0].counter).toBe(1);
  });

  it("laisse renouveler avec l'offre complete", async () => {
    const { send, store } = loadWorker({
      storage: { vault: vaultWith(ENTRY), syncSession: session("pro") },
    });
    await send({ action: "setEncodingKey", encodingKey: "clef" }, FROM_POPUP);

    const response = await send({ action: "applyChange", id: "e1", renew: true }, FROM_POPUP);

    expect(response.ok).toBe(true);
    expect(store.vault.entries[0].counter).toBe(2);
  });

  it("ne fait que renouveler, meme sans drapeau renew", async () => {
    const { send, store } = loadWorker({
      storage: { vault: vaultWith(ENTRY), syncSession: session("free") },
    });
    await send({ action: "setEncodingKey", encodingKey: "clef" }, FROM_POPUP);

    // L'ancien chemin de migration ne doit pas contourner l'offre.
    const response = await send({ action: "applyChange", id: "e1" }, FROM_POPUP);

    expect(response.ok).toBe(false);
    expect(store.vault.entries[0]).toMatchObject({ counter: 1 });
  });

  it("ne calcule meme pas l'apercu d'un renouvellement interdit", async () => {
    const { send } = loadWorker({
      storage: { vault: vaultWith(ENTRY), syncSession: session("free") },
    });
    await send({ action: "setEncodingKey", encodingKey: "clef" }, FROM_POPUP);

    const response = await send({ action: "previewChange", id: "e1", renew: true }, FROM_POPUP);

    expect(response.ok).toBe(false);
    expect(response.error).toContain("offre complete");
  });
});
