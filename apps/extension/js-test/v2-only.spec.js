/**
 * Le carnet n'accepte que des entrees v2.
 *
 * Chaque chemin de lecture — carnet local, import, synchronisation, fusion —
 * doit ecarter sans erreur toute entree `v != 2`. Le vecteur est partage :
 * shared/vault-fixtures/v2-only.json, voir shared/spec/vault-merge.md.
 */
const path = require("node:path");
const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;

const fixture = require("./v2-only.json");
const { loadVault, mergeVaults, emptyVault, newEntry, keepV2Entries } = require("../vault");
const { exportVault, importVault, deriveTransferKey, b64e } = require("../transfer");
const { syncVault } = require("../sync");

const clone = (value) => JSON.parse(JSON.stringify(value));
const ids = (vault) => vault.entries.map((e) => e.id).sort();
const expected = [...fixture.expectedIds].sort();

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

describe("carnet v2 seulement (vecteur partage)", () => {
  it("le vecteur contient bien des entrees a ecarter", () => {
    expect(fixture.vault.entries.length).toBeGreaterThan(fixture.expectedIds.length);
  });

  it("ecarte les entrees non v2 au chargement du carnet local", async () => {
    const storage = memoryStorage({ vault: clone(fixture.vault) });
    expect(ids(await loadVault(storage))).toStrictEqual(expected);
  });

  it("ecarte les entrees non v2 a l'import", async () => {
    const payload = await exportVault(clone(fixture.vault), "clef");
    expect(ids(await importVault(payload, "clef"))).toStrictEqual(expected);
  });

  it("ecarte les entrees non v2 a la fusion, dans les deux sens", () => {
    const local = emptyVault();
    const a = mergeVaults(local, clone(fixture.vault)).vault;
    const b = mergeVaults(clone(fixture.vault), local).vault;
    expect(ids(a)).toStrictEqual(expected);
    expect(ids(b)).toStrictEqual(expected);
  });

  it("ecarte les entrees non v2 a la synchronisation, sans les repousser", async () => {
    const key = await deriveTransferKey("clef");
    const rows = [];
    for (const entry of fixture.vault.entries) {
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

    expect(ids(result.vault)).toStrictEqual(expected);
    expect(pushed[0].entries.map((r) => r.entry_id).sort()).toStrictEqual(expected);
  });

  it("keepV2Entries ne garde que les ids attendus", () => {
    expect(ids(keepV2Entries(clone(fixture.vault)))).toStrictEqual(expected);
  });
});

describe("aucune ecriture ne produit une entree non v2", () => {
  it("une entree nait en v2, meme si on demande autre chose", () => {
    expect(newEntry("a.fr").v).toBe(2);
    expect(newEntry("a.fr", { v: 1 }).v).toBe(2);
  });

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

  it("refuse d'enregistrer une entree v1", async () => {
    const storage = memoryStorage();
    const worker = loadWorker(storage);
    const entry = { ...newEntry("vieux.fr"), v: 1 };

    const resp = await worker.saveEntry(entry);

    expect(resp.ok).toBe(false);
    expect(storage.store.vault).toBeUndefined();
  });

  it("ne laisse pas une mise a jour repasser une entree en v1", async () => {
    const entry = newEntry("neuf.fr");
    const storage = memoryStorage({ vault: { ...emptyVault(), entries: [entry] } });
    const worker = loadWorker(storage);

    const resp = await worker.saveEntry({ ...entry, length: 12, v: 1 });

    expect(resp.ok).toBe(false);
    expect(storage.store.vault.entries[0].v).toBe(2);
    expect(storage.store.vault.entries[0].length).toBe(20);
  });

  it("disparait du stockage a la prochaine ecriture", async () => {
    const storage = memoryStorage({ vault: clone(fixture.vault) });
    const worker = loadWorker(storage);

    await worker.saveEntry(newEntry("autre.fr"));

    expect(storage.store.vault.entries.every((e) => e.v === 2)).toBe(true);
    expect(storage.store.vault.entries.map((e) => e.id)).toEqual(
      expect.arrayContaining(fixture.expectedIds),
    );
  });

  it("ignore une entree v1 a l'import par le service worker", async () => {
    const storage = memoryStorage();
    const worker = loadWorker(storage);

    const resp = await worker.importVaultPayload(await exportVault(clone(fixture.vault), "clef"));

    expect(resp.ok).toBe(true);
    expect(ids(storage.store.vault)).toStrictEqual(expected);
  });
});
