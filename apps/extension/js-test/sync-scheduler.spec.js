/**
 * Synchronisation automatique (shared/spec/vault-sync.md) : l'ordonnanceur
 * seul, puis son cablage dans le service worker.
 */
const path = require("node:path");
const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;

const { createSyncScheduler, syncFailureCode } = require("../sync-scheduler");

/** Promesse resolue a la main : une synchronisation qui dure. */
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

describe("ordonnanceur de synchronisation", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function scheduler(options = {}) {
    const run = options.run || jest.fn(async () => ({ ok: true }));
    const onResult = jest.fn();
    const s = createSyncScheduler({ run, onResult, now: () => Date.now(), ...options });
    return { s, run, onResult };
  }

  it("attend 2 s de calme et fusionne les declencheurs rapproches", async () => {
    const { s, run } = scheduler();

    s.trigger();
    await jest.advanceTimersByTimeAsync(1500);
    s.trigger();
    await jest.advanceTimersByTimeAsync(1500);
    expect(run).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(500);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("ne double jamais une synchronisation en cours et n'en relance qu'une", async () => {
    const gate = deferred();
    const run = jest.fn().mockImplementationOnce(() => gate.promise);
    run.mockImplementation(async () => ({ ok: true }));
    const { s } = scheduler({ run });

    s.trigger();
    await jest.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(1);

    s.trigger();
    await jest.advanceTimersByTimeAsync(2000);
    s.trigger();
    await jest.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(1);

    gate.resolve({ ok: true });
    await jest.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(10000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("espace les ouvertures de 30 s", async () => {
    const { s, run } = scheduler();

    expect(s.triggerOpen()).toBe(true);
    await jest.advanceTimersByTimeAsync(2000);
    expect(s.triggerOpen()).toBe(false);
    await jest.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(26000);
    expect(s.triggerOpen()).toBe(true);
    await jest.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("ne lance rien sans session ou sans clef", async () => {
    const { s, run, onResult } = scheduler({ canSync: async () => false });

    s.trigger();
    await jest.advanceTimersByTimeAsync(2000);

    expect(run).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
    expect(await s.runNow()).toStrictEqual({ ok: false, skipped: true });
  });

  it("rend un echec comme resultat, sans le lever", async () => {
    const run = jest.fn(async () => {
      throw new Error("Service injoignable : coupure");
    });
    const { s, onResult } = scheduler({ run });

    s.trigger();
    await jest.advanceTimersByTimeAsync(2000);

    expect(onResult).toHaveBeenCalledWith({ ok: false, error: "Service injoignable : coupure" });
  });

  it("synchronise tout de suite sur demande, apres celle en cours", async () => {
    const gate = deferred();
    const run = jest.fn().mockImplementationOnce(() => gate.promise);
    run.mockImplementation(async () => ({ ok: true, entries: 3 }));
    const { s } = scheduler({ run });

    s.trigger();
    await jest.advanceTimersByTimeAsync(2000);
    s.trigger();
    const now = s.runNow();
    expect(s.pending).toBe(false);

    gate.resolve({ ok: true });
    expect(await now).toStrictEqual({ ok: true, entries: 3 });
    await jest.advanceTimersByTimeAsync(10000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("reduit un echec a un motif traduisible", () => {
    expect(syncFailureCode("Service injoignable : coupure")).toBe("network");
    expect(syncFailureCode("401 : expired")).toBe("auth");
    expect(syncFailureCode("402 : plan")).toBe("plan");
    expect(syncFailureCode("403 : devices")).toBe("forbidden");
    expect(syncFailureCode("autre chose")).toBe("other");
  });
});

const SESSION = { endpoint: "https://example.test/api", accessToken: "a", refreshToken: "r" };

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

/** Appels au service de synchronisation (pas la liste des suffixes). */
const syncCalls = () =>
  global.fetch.mock.calls.filter(([url]) => String(url).startsWith(SESSION.endpoint));

/** Attend une condition pendant que le chiffrement reel avance. */
async function until(cond) {
  for (let i = 0; i < 20000 && !cond(); i += 1) {
    await new Promise((r) => setImmediate(r));
  }
}

/** Laisse filer les minuteries et le travail asynchrone reel (chiffrement). */
async function settle(ms) {
  await jest.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 50; i += 1) {
    await new Promise((r) => setImmediate(r));
    await jest.advanceTimersByTimeAsync(0);
  }
}

describe("synchronisation automatique dans le service worker", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick", "queueMicrotask"] });
    global.fetch = jest.fn(() => Promise.reject(new Error("coupure")));
  });
  afterEach(() => {
    jest.useRealTimers();
    delete global.fetch;
  });

  it("synchronise 2 s apres un enregistrement et garde l'echec pour la popup", async () => {
    const { send, store } = loadWorker({ syncSession: SESSION });
    await send({ action: "setEncodingKey", encodingKey: "clef" });

    expect((await send({ action: "saveSite", domain: "example.com" })).ok).toBe(true);
    await settle(1000);
    expect(syncCalls()).toHaveLength(0);

    await settle(1000);
    await until(() => syncCalls().length > 0);
    expect(syncCalls().length).toBeGreaterThan(0);
    await until(() => store.syncLastStatus);
    const status = await send({ action: "syncStatus" });
    expect(status.lastStatus).toMatchObject({ ok: false, code: "network" });
  });

  it("synchronise apres une suppression et un reglage modifie", async () => {
    const { send, store } = loadWorker({ syncSession: SESSION });
    await send({ action: "setEncodingKey", encodingKey: "clef" });
    const { entry } = await send({ action: "saveSite", domain: "example.com" });
    await send({ action: "setParams", data: { lengthNumber: 27 } });
    await settle(2000);
    await until(() => syncCalls().length > 0);
    expect(syncCalls().length).toBeGreaterThan(0);

    await until(() => store.syncLastStatus);
    global.fetch.mockClear();
    await send({ action: "deleteEntry", id: entry.id });
    await settle(2000);
    await until(() => syncCalls().length > 0);
    expect(syncCalls().length).toBeGreaterThan(0);
  });

  it("ne synchronise rien sans clef maitresse", async () => {
    const { send, store } = loadWorker({ syncSession: SESSION });

    await send({ action: "saveSite", domain: "example.com" });
    await send({ action: "syncAutoOpen" });
    await settle(5000);

    expect(syncCalls()).toHaveLength(0);
    expect(store.syncLastStatus).toBeUndefined();
  });

  it("ne synchronise rien sans session", async () => {
    const { send, store } = loadWorker();
    await send({ action: "setEncodingKey", encodingKey: "clef" });

    await send({ action: "saveSite", domain: "example.com" });
    await settle(5000);

    expect(syncCalls()).toHaveLength(0);
    expect(store.syncLastStatus).toBeUndefined();
  });

  it("synchronise a l'ouverture, pas plus d'une fois par 30 s", async () => {
    const { send } = loadWorker({ syncSession: SESSION });
    await send({ action: "setEncodingKey", encodingKey: "clef" });

    expect((await send({ action: "syncAutoOpen" })).scheduled).toBe(true);
    expect((await send({ action: "syncAutoOpen" })).scheduled).toBe(false);
    await settle(2000);
    await until(() => syncCalls().length > 0);
    expect(syncCalls().length).toBeGreaterThan(0);
  });

  it("n'affiche aucun echec une fois deconnecte", async () => {
    const { send } = loadWorker({
      syncSession: SESSION,
      syncLastStatus: { ok: false, code: "network" },
    });
    await send({ action: "syncLogout" });
    expect((await send({ action: "syncStatus" })).lastStatus).toBeNull();
  });
});
