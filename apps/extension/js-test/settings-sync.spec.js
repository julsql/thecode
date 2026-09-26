/**
 * Reglages par defaut partages avec le compte (shared/spec/default-settings.md).
 *
 * Le serveur est simule : ce qui compte est ce qui part sur le reseau (chiffre),
 * quelle valeur l'emporte, et qu'un blob illisible n'ecrase rien.
 */
const path = require("node:path");
const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;

const SESSION = {
  endpoint: "https://example.test/api",
  accessToken: "a",
  refreshToken: "r",
};

const OLD = "2026-01-01T00:00:00Z";
const NEW = "2026-02-01T00:00:00Z";

function settings(length, updatedAt, charset = {}) {
  return {
    length,
    charset: { lower: true, upper: true, symbols: true, numbers: true, ...charset },
    updatedAt,
  };
}

/** Serveur en memoire : carnet vide, un blob de reglages par compte. */
function fakeServer(initial = null) {
  let stored = initial;
  let revision = 0;
  const puts = [];

  const reply = (status, body) =>
    Promise.resolve({
      ok: status < 400,
      status,
      statusText: String(status),
      json: () => Promise.resolve(body),
    });

  const fetchImpl = (url, init = {}) => {
    if (url.endsWith("/v1/settings")) {
      if (init.method === "PUT") {
        puts.push(init.body);
        stored = JSON.parse(init.body);
        return reply(204);
      }
      return stored ? reply(200, stored) : reply(204);
    }
    if (url.endsWith("/v1/vault")) {
      if (!init.body) return reply(200, { revision, entries: [] });
      revision += 1;
      return reply(200, { revision, accepted: 0 });
    }
    return reply(404, { detail: "absent" });
  };

  return {
    fetchImpl,
    puts,
    get stored() {
      return stored;
    },
  };
}

async function encryptFor(value, masterKey) {
  const { deriveTransferKey } = require("../transfer");
  const key = await deriveTransferKey(masterKey);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plain);
  const b64 = (buf) => Buffer.from(buf).toString("base64url");
  return { nonce: b64(nonce), blob: b64(cipher) };
}

async function decryptWith(row, masterKey) {
  const { deriveTransferKey } = require("../transfer");
  const key = await deriveTransferKey(masterKey);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(row.nonce, "base64url") },
    key,
    Buffer.from(row.blob, "base64url"),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

describe("syncSettings", () => {
  let server;
  const { syncSettings, normalizeSettings } = require("../sync");

  function useServer(initial) {
    server = fakeServer(initial);
    global.fetch = server.fetchImpl;
  }

  it("pousse, chiffres, des reglages locaux quand le compte n'en a pas", async () => {
    useServer();
    const local = settings(32, NEW);

    const res = await syncSettings(local, "clef", SESSION);

    expect(res.applied).toBe(false);
    expect(server.puts).toHaveLength(1);
    expect(Object.keys(server.stored).sort()).toStrictEqual(["blob", "nonce"]);
    expect(await decryptWith(server.stored, "clef")).toStrictEqual(local);
  });

  it("ne pousse pas des reglages jamais modifies", async () => {
    useServer();
    const res = await syncSettings(settings(20, ""), "clef", SESSION);
    expect(res.applied).toBe(false);
    expect(server.puts).toHaveLength(0);
  });

  it("applique la valeur distante plus recente sans la repousser", async () => {
    useServer(await encryptFor(settings(12, NEW, { symbols: false }), "clef"));

    const res = await syncSettings(settings(30, OLD), "clef", SESSION);

    expect(res.applied).toBe(true);
    expect(res.settings).toStrictEqual(settings(12, NEW, { symbols: false }));
    expect(server.puts).toHaveLength(0);
  });

  it("garde la distante a egalite", async () => {
    useServer(await encryptFor(settings(12, NEW), "clef"));
    const res = await syncSettings(settings(30, NEW), "clef", SESSION);
    expect(res.applied).toBe(true);
    expect(res.settings.length).toBe(12);
    expect(server.puts).toHaveLength(0);
  });

  it("pousse la locale plus recente", async () => {
    useServer(await encryptFor(settings(12, OLD), "clef"));

    const res = await syncSettings(settings(30, NEW), "clef", SESSION);

    expect(res.applied).toBe(false);
    expect(server.puts).toHaveLength(1);
    expect((await decryptWith(server.stored, "clef")).length).toBe(30);
  });

  it("ignore un blob indechiffrable sans rien ecraser", async () => {
    const foreign = await encryptFor(settings(12, OLD), "autre-clef");
    useServer(foreign);

    const res = await syncSettings(settings(30, NEW), "clef", SESSION);

    expect(res.applied).toBe(false);
    expect(res.settings.length).toBe(30);
    expect(server.puts).toHaveLength(0);
    expect(server.stored).toBe(foreign);
  });

  it("ignore une valeur distante inutilisable", async () => {
    useServer(
      await encryptFor(
        settings(12, NEW, { lower: false, upper: false, symbols: false, numbers: false }),
        "clef",
      ),
    );
    const res = await syncSettings(settings(30, OLD), "clef", SESSION);
    expect(res.applied).toBe(false);
    expect(server.puts).toHaveLength(0);
  });

  it("borne la longueur et rejette ce qui n'est pas des reglages", () => {
    expect(normalizeSettings(settings(99, NEW)).length).toBe(40);
    expect(normalizeSettings(settings(1, NEW)).length).toBe(4);
    expect(normalizeSettings(null)).toBeNull();
    expect(normalizeSettings({ length: 20 })).toBeNull();
    expect(normalizeSettings({ length: "x", charset: { lower: true } })).toBeNull();
  });
});

/** Recharge background.js avec un stockage simule. */
function loadWorker(storage = {}) {
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
  jest.resetModules();
  require(path.join(__dirname, "..", "background.js"));
  const send = (request) => new Promise((resolve) => listeners[0](request, {}, resolve));
  return { send, store };
}

describe("reglages dans le service worker", () => {
  it("date les reglages a chaque modification, pas quand rien ne change", async () => {
    const { send, store } = loadWorker();

    await send({ action: "setParams", data: { lengthNumber: 20 } });
    expect(store.paramsUpdatedAt).toBeUndefined();

    await send({ action: "setParams", data: { lengthNumber: 24 } });
    expect(store.paramsUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("synchronise les reglages apres le carnet sur « Synchroniser »", async () => {
    const server = fakeServer(await encryptFor(settings(12, NEW, { numbers: false }), "clef"));
    global.fetch = server.fetchImpl;
    const { send, store } = loadWorker({
      syncSession: SESSION,
      lengthNumber: 30,
      paramsUpdatedAt: OLD,
    });
    await send({ action: "setEncodingKey", encodingKey: "clef" });

    const res = await send({ action: "syncNow" });

    expect(res.ok).toBe(true);
    expect(res.settingsSynced).toBe(true);
    const { params } = await send({ action: "getParams" });
    expect(params).toMatchObject({ lengthNumber: 12, chiState: false, minState: true });
    expect(store.paramsUpdatedAt).toBe(NEW);
    expect(server.puts).toHaveLength(0);
  });

  it("pousse des reglages locaux plus recents", async () => {
    const server = fakeServer(await encryptFor(settings(12, OLD), "clef"));
    global.fetch = server.fetchImpl;
    const { send } = loadWorker({ syncSession: SESSION });
    await send({ action: "setEncodingKey", encodingKey: "clef" });
    await send({ action: "setParams", data: { lengthNumber: 33 } });

    await send({ action: "syncNow" });

    expect(server.puts).toHaveLength(1);
    expect(await decryptWith(server.stored, "clef")).toMatchObject({ length: 33 });
  });

  it("ne fait pas echouer la synchronisation du carnet si les reglages echouent", async () => {
    const server = fakeServer();
    global.fetch = (url, init) =>
      url.endsWith("/v1/settings")
        ? Promise.reject(new Error("coupure"))
        : server.fetchImpl(url, init);
    const { send } = loadWorker({ syncSession: SESSION });
    await send({ action: "setEncodingKey", encodingKey: "clef" });
    jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await send({ action: "syncNow" });

    expect(res.ok).toBe(true);
    expect(res.settingsSynced).toBe(false);
    console.error.mockRestore();
  });
});
