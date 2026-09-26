/**
 * La clef survit au recyclage du service worker, pas a la fermeture du
 * navigateur : storage.session vit en memoire et n'est ouvert qu'aux pages
 * de l'extension.
 */
const path = require("node:path");
const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;

/** Zone de stockage en memoire, partagee entre deux reveils du worker. */
function memoryArea(store = {}) {
  return {
    store,
    get: async (keys) =>
      Object.fromEntries(
        (Array.isArray(keys) ? keys : [keys]).filter((k) => k in store).map((k) => [k, store[k]]),
      ),
    set: async (obj) => Object.assign(store, obj),
    remove: async (keys) => (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]),
    setAccessLevel: jest.fn(async () => {}),
  };
}

/** Charge le worker comme au reveil, avec la session donnee. */
function wakeWorker(session) {
  const listeners = [];
  global.chrome = {
    runtime: {
      getURL: (p) => `data:text/plain,${p}`,
      onMessage: { addListener: (fn) => listeners.push(fn) },
    },
    storage: { local: memoryArea(), session, onChanged: { addListener: () => {} } },
  };
  global.browser = global.chrome;
  jest.resetModules();
  require(path.join(__dirname, "..", "background.js"));
  return (request) => new Promise((resolve) => listeners[0](request, {}, resolve));
}

const sample = "clef-de-demonstration";

describe("clef gardee pour la session du navigateur", () => {
  it("revient apres le recyclage du service worker", async () => {
    const session = memoryArea();
    await wakeWorker(session)({ action: "setEncodingKey", encodingKey: sample });

    // Nouveau reveil : la memoire du worker est vide, la session non.
    const send = wakeWorker(session);
    expect((await send({ action: "checkEncodingKey" })).hasEncodingKey).toBe(true);
    expect((await send({ action: "getEncodingKey" })).encodingKey).toBe(sample);
  });

  it("disparait quand on l'efface", async () => {
    const session = memoryArea();
    const send = wakeWorker(session);
    await send({ action: "setEncodingKey", encodingKey: sample });
    await send({ action: "clearEncodingKey" });

    expect(session.store).toEqual({});
    expect((await wakeWorker(session)({ action: "checkEncodingKey" })).hasEncodingKey).toBe(false);
  });

  it("n'est ouverte qu'aux pages de l'extension", async () => {
    const session = memoryArea();
    wakeWorker(session);
    expect(session.setAccessLevel).toHaveBeenCalledWith({ accessLevel: "TRUSTED_CONTEXTS" });
  });

  it("reste en memoire sans storage.session", async () => {
    const send = wakeWorker(undefined);
    await send({ action: "setEncodingKey", encodingKey: sample });
    expect((await send({ action: "checkEncodingKey" })).hasEncodingKey).toBe(true);
  });
});
