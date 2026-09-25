/**
 * Identifiant saisi dans la popup.
 *
 * Il designe le compte — domaine + identifiant — et entre dans la derivation
 * v2. Vide, il ne change rien au calcul ; absent (content.js), la premiere
 * entree du domaine est retenue comme avant. La v1 l'ignore.
 */
const path = require("node:path");
const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;

const {
  emptyVault,
  newEntry,
  saveVault,
  loadVault,
  findByDomainAndLogin,
  upsertSiteEntry,
} = require("../vault");
const { generatePasswordV2 } = require("../core-v2");

const CHARSET = { lower: true, upper: true, symbols: true, numbers: true };

function loadWorker() {
  const store = {};
  const listeners = [];
  global.chrome = {
    runtime: {
      onMessage: { addListener: (fn) => listeners.push(fn) },
      getURL: (p) => `chrome-extension://x/${p}`,
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
  jest.resetModules();
  const worker = require(path.join(__dirname, "..", "background.js"));
  worker.setEncodingKeyForTests("clef");
  const send = (request, sender = {}) =>
    new Promise((resolve) => listeners[0](request, sender, resolve));
  return { worker, storage: global.chrome.storage.local, store, send };
}

/** Deux comptes sur google.com, aux reglages differents. */
async function twoAccounts(storage) {
  const vault = emptyVault();
  vault.entries.push(newEntry("google.com", { domains: ["google.com"], login: "perso" }));
  vault.entries.push(
    newEntry("google.com", {
      domains: ["google.com"],
      login: "pro",
      length: 12,
      charset: { ...CHARSET, symbols: false },
    }),
  );
  await saveVault(storage, vault);
  return vault;
}

describe("carnet : un compte = domaine + identifiant", () => {
  it("retrouve l'entree du bon identifiant", () => {
    const vault = emptyVault();
    vault.entries.push(newEntry("a.fr", { login: "x" }), newEntry("a.fr", { login: "" }));
    expect(findByDomainAndLogin(vault, "a.fr", "x").login).toBe("x");
    expect(findByDomainAndLogin(vault, "a.fr", "").login).toBe("");
    expect(findByDomainAndLogin(vault, "a.fr", "y")).toBeNull();
  });

  it("cree une entree v2 pour un identifiant inconnu", () => {
    const vault = emptyVault();
    vault.entries.push(newEntry("a.fr", { login: "x" }));

    const { entry, updated } = upsertSiteEntry(vault, {
      domain: "a.fr",
      login: "y",
      length: 16,
      charset: CHARSET,
    });

    expect(updated).toBe(false);
    expect(entry).toMatchObject({ siteKey: "a.fr", login: "y", length: 16, v: 2 });
    expect(vault.entries).toHaveLength(2);
  });

  it("met a jour longueur et caracteres sans toucher au siteKey", () => {
    const vault = emptyVault();
    const original = newEntry("google.com", { domains: ["google.com", "google.fr"], login: "x" });
    vault.entries.push(original);

    const { entry, updated } = upsertSiteEntry(vault, {
      domain: "google.fr",
      login: "x",
      length: 30,
      charset: { ...CHARSET, symbols: false },
    });

    expect(updated).toBe(true);
    expect(entry.id).toBe(original.id);
    expect(entry).toMatchObject({ siteKey: "google.com", length: 30, counter: 1, v: 2 });
    expect(entry.charset.symbols).toBe(false);
    expect(vault.entries).toHaveLength(1);
  });
});

describe("generation avec identifiant", () => {
  it("fait entrer l'identifiant dans la derivation v2", async () => {
    const { worker } = loadWorker();

    const res = await worker.generatePasswordForUrl("https://inconnu.fr/", 2, "moi");

    expect(res.password).toBe(await generatePasswordV2("inconnu.fr", "clef", 20, { login: "moi" }));
    expect(res.password).not.toBe(await generatePasswordV2("inconnu.fr", "clef", 20));
    expect(res.login).toBe("moi");
  });

  it("ignore les espaces autour de l'identifiant", async () => {
    const { worker } = loadWorker();

    const padded = await worker.generatePasswordForUrl("https://inconnu.fr/", 2, "  moi ");
    const clean = await worker.generatePasswordForUrl("https://inconnu.fr/", 2, "moi");

    expect(padded.password).toBe(clean.password);
    expect(padded.login).toBe("moi");
  });

  it("un identifiant vide ne change rien au calcul", async () => {
    const { worker } = loadWorker();

    const empty = await worker.generatePasswordForUrl("https://inconnu.fr/", 2, "");
    const absent = await worker.generatePasswordForUrl("https://inconnu.fr/", 2);

    expect(empty.password).toBe(absent.password);
  });

  it("la v1 ignore l'identifiant", async () => {
    const { worker } = loadWorker();

    const withLogin = await worker.generatePasswordForUrl("https://inconnu.fr/", 1, "moi");
    const without = await worker.generatePasswordForUrl("https://inconnu.fr/", 1);

    expect(withLogin.password).toBe(without.password);
  });

  it("choisit l'entree du compte demande", async () => {
    const { worker, storage } = loadWorker();
    const vault = await twoAccounts(storage);

    const res = await worker.generatePasswordForUrl("https://google.com/", 2, "pro");

    expect(res.known).toBe(true);
    expect(res.entryId).toBe(vault.entries[1].id);
    expect(res.login).toBe("pro");
    expect(res.password).toHaveLength(12);
    expect(res.password).toBe(await worker.passwordForEntry(vault.entries[1]));
  });

  it("garde la premiere entree quand aucun identifiant n'est envoye", async () => {
    // Le remplissage automatique (content.js) n'envoie pas d'identifiant.
    const { worker, storage } = loadWorker();
    const vault = await twoAccounts(storage);

    const res = await worker.generatePasswordForUrl("https://google.com/");

    expect(res.entryId).toBe(vault.entries[0].id);
    expect(res.login).toBe("perso");
  });

  it("traite un identifiant absent du carnet comme un compte inconnu", async () => {
    const { worker, storage } = loadWorker();
    await twoAccounts(storage);

    const res = await worker.generatePasswordForUrl("https://google.com/", 2, "autre");

    expect(res.known).toBe(false);
    expect(res.entryId).toBeUndefined();
    expect(res.password).toBe(
      await generatePasswordV2("google.com", "clef", 20, { login: "autre" }),
    );
  });

  it("borne un identifiant trop long", async () => {
    const { worker } = loadWorker();

    const long = await worker.generatePasswordForUrl("https://x.fr/", 2, "a".repeat(500));
    const capped = await worker.generatePasswordForUrl("https://x.fr/", 2, "a".repeat(120));

    expect(long.password).toBe(capped.password);
  });

  it("transmet l'identifiant envoye par la popup", async () => {
    const { send } = loadWorker();

    const res = await send({
      action: "generatePassword",
      url: "https://inconnu.fr/",
      version: 2,
      login: "moi",
    });

    expect(res.password).toBe(await generatePasswordV2("inconnu.fr", "clef", 20, { login: "moi" }));
  });
});

describe("enregistrement depuis la popup", () => {
  it("cree une entree v2 avec l'identifiant saisi", async () => {
    const { send, storage } = loadWorker();

    const resp = await send({ action: "saveSite", domain: "banque.fr", login: "moi" });

    expect(resp).toMatchObject({ ok: true, updated: false });
    const [entry] = (await loadVault(storage)).entries;
    expect(entry).toMatchObject({ siteKey: "banque.fr", login: "moi", v: 2, length: 20 });
  });

  it("met a jour le compte existant avec les parametres courants", async () => {
    const { send, storage } = loadWorker();
    const vault = await twoAccounts(storage);
    await send({ action: "setParams", data: { lengthNumber: 32 } });

    const resp = await send({ action: "saveSite", domain: "google.com", login: "pro" });

    expect(resp).toMatchObject({ ok: true, updated: true });
    const entries = (await loadVault(storage)).entries;
    expect(entries).toHaveLength(2);
    const pro = entries.find((e) => e.id === vault.entries[1].id);
    expect(pro).toMatchObject({ siteKey: "google.com", login: "pro", length: 32 });
  });

  it("un autre identifiant sur le meme site cree un autre compte", async () => {
    const { send, storage } = loadWorker();
    await twoAccounts(storage);

    await send({ action: "saveSite", domain: "google.com", login: "troisieme" });

    expect((await loadVault(storage)).entries.map((e) => e.login).sort()).toStrictEqual([
      "perso",
      "pro",
      "troisieme",
    ]);
  });

  it("refuse sans site", async () => {
    const { send } = loadWorker();
    expect(await send({ action: "saveSite", domain: "", login: "x" })).toMatchObject({
      ok: false,
    });
  });

  it("refuse un content script", async () => {
    const { send, store } = loadWorker();
    const resp = await send(
      { action: "saveSite", domain: "evil.fr", login: "x" },
      { tab: { id: 1 }, url: "https://evil.fr/" },
    );
    expect(resp.error).toBeDefined();
    expect(store.vault).toBeUndefined();
  });
});
