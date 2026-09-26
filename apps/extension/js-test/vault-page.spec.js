/**
 * Ecran de gestion du carnet : ce qui est liste, et la suppression en pierre
 * tombale ecrite par le service worker.
 */
const path = require("node:path");
const { visibleEntries, charsetLabel } = require("../vault-page");

const OLD = "2020-01-01T00:00:00Z";

function entry(id, overrides = {}) {
  return {
    id,
    label: id,
    siteKey: `${id}.example`,
    domains: [`${id}.example`],
    login: "",
    counter: 1,
    length: 20,
    charset: { lower: true, upper: true, symbols: true, numbers: true },
    updatedAt: OLD,
    ...overrides,
  };
}

describe("liste des entrees", () => {
  it("ecarte les pierres tombales et trie par libelle puis identifiant", () => {
    const vault = {
      entries: [
        entry("b"),
        entry("a2", { label: "a", login: "zoe" }),
        entry("gone", { deleted: true }),
        entry("a1", { label: "a", login: "alice" }),
      ],
    };
    expect(visibleEntries(vault).map((e) => e.id)).toStrictEqual(["a1", "a2", "b"]);
  });

  it("supporte un carnet absent", () => {
    expect(visibleEntries(undefined)).toStrictEqual([]);
  });

  it("decrit les jeux de caracteres actifs", () => {
    expect(charsetLabel({ lower: true, upper: false, symbols: true, numbers: true })).toBe(
      "minuscules, chiffres, symboles",
    );
    expect(charsetLabel({})).toBe("aucun");
  });
});

function loadWorker(storage = {}) {
  const store = { ...storage };
  const listeners = [];
  global.chrome = {
    runtime: {
      getURL: (p) => `chrome-extension://x/${p}`,
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
  jest.resetModules();
  require(path.join(__dirname, "..", "background.js"));
  const send = (request, sender) =>
    new Promise((resolve) => listeners[0](request, sender, resolve));
  return { send, store };
}

// La page carnet est ouverte dans un onglet : elle a un sender.tab, mais son
// adresse est celle de l'extension.
const FROM_VAULT_PAGE = { tab: { id: 3 }, url: "chrome-extension://x/vault-page.html" };
const FROM_CONTENT_SCRIPT = { tab: { id: 7 }, url: "https://example.com/" };

describe("suppression depuis l'ecran carnet", () => {
  const vault = () => ({ schema: 1, updatedAt: OLD, entries: [entry("a"), entry("b")] });

  it("ecrit une pierre tombale datee de maintenant, sans retirer l'entree", async () => {
    const { send, store } = loadWorker({ vault: vault() });
    expect(await send({ action: "deleteEntry", id: "a" }, FROM_VAULT_PAGE)).toStrictEqual({
      ok: true,
    });

    const deleted = store.vault.entries.find((e) => e.id === "a");
    expect(deleted.deleted).toBe(true);
    expect(deleted.updatedAt > OLD).toBe(true);
    expect(deleted.updatedAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    expect(store.vault.entries.find((e) => e.id === "b").deleted).toBeUndefined();

    const listed = await send({ action: "getVault" }, FROM_VAULT_PAGE);
    expect(visibleEntries(listed.vault).map((e) => e.id)).toStrictEqual(["b"]);
  });

  it("refuse la suppression et la lecture a un content script", async () => {
    const { send, store } = loadWorker({ vault: vault() });
    expect(
      (await send({ action: "deleteEntry", id: "a" }, FROM_CONTENT_SCRIPT)).error,
    ).toBeDefined();
    expect((await send({ action: "getVault" }, FROM_CONTENT_SCRIPT)).vault).toBeUndefined();
    expect(store.vault.entries.every((e) => !e.deleted)).toBe(true);
  });

  it("ne renouvelle pas une entree supprimee", async () => {
    const { send } = loadWorker({ vault: vault() });
    await send({ action: "deleteEntry", id: "a" }, FROM_VAULT_PAGE);
    const res = await send({ action: "previewChange", id: "a" }, FROM_VAULT_PAGE);
    expect(res.ok).toBe(false);
  });
});
