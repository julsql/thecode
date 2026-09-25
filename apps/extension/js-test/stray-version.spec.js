/**
 * Une entree ne porte pas de version : un `v` residuel est ignore.
 *
 * Toute entree du carnet derive en v2. Un champ `v` lu (chargement, import,
 * synchronisation, fusion) est tolere, retire, et jamais reecrit ; l'entree
 * est gardee. Voir shared/spec/vault-merge.md, « Pas de version par entrée ».
 */
const path = require("node:path");
const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;

const {
  loadVault,
  saveVault,
  mergeVaults,
  emptyVault,
  newEntry,
  dropVersion,
  stripVersions,
} = require("../vault");
const { exportVault, importVault, deriveTransferKey, b64e } = require("../transfer");
const { syncVault } = require("../sync");
const { generatePasswordV2 } = require("../core-v2");

function strayVault(v = 1) {
  const entry = { ...newEntry("google.com", { domains: ["google.com"], login: "moi" }), v };
  return { schema: 1, updatedAt: entry.updatedAt, entries: [entry] };
}

const hasV = (vault) => vault.entries.some((e) => "v" in e);

function memoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    store,
    get: async (keys) =>
      Object.fromEntries(
        (Array.isArray(keys) ? keys : [keys]).filter((k) => k in store).map((k) => [k, store[k]]),
      ),
    set: async (obj) => Object.assign(store, obj),
    remove: async (keys) => (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]),
  };
}

function loadWorker(storage) {
  global.chrome = {
    runtime: { onMessage: { addListener: () => {} }, getURL: (p) => `chrome-extension://x/${p}` },
    storage: { local: storage, onChanged: { addListener: () => {} } },
  };
  global.browser = global.chrome;
  jest.resetModules();
  const worker = require(path.join(__dirname, "..", "background.js"));
  worker.setEncodingKeyForTests("clef");
  return worker;
}

describe("entree sans version", () => {
  it("une entree nait sans v", () => {
    expect(newEntry("site.fr")).not.toHaveProperty("v");
    expect(newEntry("site.fr", { v: 1 })).not.toHaveProperty("v");
  });

  it("dropVersion retire v sans toucher au reste", () => {
    const entry = newEntry("site.fr");
    expect(dropVersion({ ...entry, v: 3 })).toStrictEqual(entry);
    expect(stripVersions(strayVault()).entries).toHaveLength(1);
  });

  it.each([1, 2, 3])("garde l'entree et retire v = %i au chargement", async (v) => {
    const loaded = await loadVault(memoryStorage({ vault: strayVault(v) }));

    expect(loaded.entries).toHaveLength(1);
    expect(hasV(loaded)).toBe(false);
  });

  it("ne reecrit jamais v", async () => {
    const storage = memoryStorage({ vault: strayVault() });

    await saveVault(storage, await loadVault(storage));

    expect(hasV(storage.store.vault)).toBe(false);
  });

  it("retire v a l'import", async () => {
    const imported = await importVault(await exportVault(strayVault(), "clef"), "clef");

    expect(imported.entries).toHaveLength(1);
    expect(hasV(imported)).toBe(false);
  });

  it("retire v a la fusion, dans les deux sens", () => {
    for (const merged of [
      mergeVaults(emptyVault(), strayVault()).vault,
      mergeVaults(strayVault(), emptyVault()).vault,
    ]) {
      expect(merged.entries).toHaveLength(1);
      expect(hasV(merged)).toBe(false);
    }
  });

  it("retire v a la synchronisation, sans le repousser", async () => {
    const key = await deriveTransferKey("clef");
    const rows = [];
    for (const entry of strayVault().entries) {
      const nonce = crypto.getRandomValues(new Uint8Array(12));
      const plain = new TextEncoder().encode(JSON.stringify(entry));
      const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plain);
      rows.push({ entry_id: entry.id, nonce: b64e(nonce), blob: b64e(cipher), deleted: false });
    }
    const pushed = [];
    global.fetch = (url, init) => {
      if (init?.body) pushed.push(JSON.parse(init.body));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            init?.body ? { revision: 1, accepted: 1 } : { revision: 0, entries: rows },
          ),
      });
    };

    const session = { endpoint: "https://example.test", accessToken: "a", refreshToken: "r" };
    const result = await syncVault(emptyVault(), "clef", session);

    expect(result.vault.entries).toHaveLength(1);
    expect(hasV(result.vault)).toBe(false);
    const sent = await Promise.all(
      pushed[0].entries.map(async (row) => {
        const plain = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: Buffer.from(row.nonce, "base64") },
          key,
          Buffer.from(row.blob, "base64"),
        );
        return JSON.parse(new TextDecoder().decode(plain));
      }),
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toHaveProperty("v");
  });
});

describe("derivation d'une entree portant un v residuel", () => {
  it("derive toujours en v2", async () => {
    const vault = strayVault(1);
    const [entry] = vault.entries;
    const worker = loadWorker(memoryStorage({ vault }));

    const res = await worker.generatePasswordForUrl("https://google.com/", undefined, "moi");

    expect(res.known).toBe(true);
    expect(res.password).toBe(
      await generatePasswordV2("google.com", "clef", entry.length, { login: "moi", counter: 1 }),
    );
  });

  it("enregistrer en mode v1 met a jour l'entree, sans version", async () => {
    // La popup en v1 enregistre comme en v2 : l'entree existante est gardee.
    const vault = strayVault(1);
    const storage = memoryStorage({ vault });
    const worker = loadWorker(storage);

    const resp = await worker.saveSite("google.com", "moi");

    expect(resp).toMatchObject({ ok: true, updated: true });
    expect(resp.entry.id).toBe(vault.entries[0].id);
    expect(hasV(storage.store.vault)).toBe(false);
  });

  it("importe par le service worker sans reecrire v", async () => {
    const storage = memoryStorage();
    const worker = loadWorker(storage);

    const resp = await worker.importVaultPayload(await exportVault(strayVault(), "clef"));

    expect(resp.ok).toBe(true);
    expect(storage.store.vault.entries).toHaveLength(1);
    expect(hasV(storage.store.vault)).toBe(false);
  });
});
