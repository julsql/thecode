/**
 * « Verrouiller » ferme toute la session, pas seulement l'ecran carnet : la
 * clef est gardee mais inutilisable — ni generation (popup comme menu de la
 * page), ni carnet, ni synchronisation — jusqu'a sa ressaisie.
 * Voir shared/spec/vault-lock.md.
 */
const path = require("node:path");
const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;
const { VAULT_SESSION_STORAGE_KEY } = require("../vault-session");

const SESSION_KEY = "clef-de-session";
const OTHER_KEY = "clef-differente";
const FROM_POPUP = { url: "chrome-extension://x/popup.html" };
const FROM_CONTENT_SCRIPT = {
  tab: { id: 7, url: "https://example.com/" },
  url: "https://example.com/",
};

function fakeArea(store = {}) {
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

/** Charge (ou recharge, comme au reveil) le service worker. */
function loadWorker({ local = {}, session = {} } = {}) {
  const localArea = fakeArea(local);
  const sessionArea = fakeArea(session);
  const listeners = [];
  global.chrome = {
    runtime: {
      getURL: (p) => `chrome-extension://x/${p}`,
      onMessage: { addListener: (fn) => listeners.push(fn) },
    },
    storage: { local: localArea, session: sessionArea, onChanged: { addListener: () => {} } },
  };
  global.browser = global.chrome;
  jest.resetModules();
  const worker = require(path.join(__dirname, "..", "background.js"));
  const send = (request, sender = FROM_POPUP) =>
    new Promise((resolve) => listeners[0](request, sender, resolve));
  return { send, worker, local: localArea.store, session: sessionArea.store };
}

async function lockedWorker(options) {
  const loaded = loadWorker({ session: { encodingKey: SESSION_KEY }, ...options });
  expect(await loaded.send({ action: "lockSession" })).toStrictEqual({ ok: true, locked: true });
  return loaded;
}

const generate = { action: "generatePassword", url: "https://example.com/login" };

describe("verrou de la session", () => {
  it("garde la clef mais refuse la generation depuis la popup", async () => {
    const { send, session } = await lockedWorker();
    expect(session.encodingKey).toBe(SESSION_KEY);
    const resp = await send({ ...generate, version: 2 });
    expect(resp.locked).toBe(true);
    expect(resp.error).toMatch(/verrouillé/);
    expect(resp.password).toBeUndefined();
  });

  it("refuse la generation au menu de la page (content script)", async () => {
    const { send } = await lockedWorker();
    const resp = await send(generate, FROM_CONTENT_SCRIPT);
    expect(resp.locked).toBe(true);
    expect(resp.password).toBeUndefined();
  });

  it("refuse aussi l'appel direct de generatePasswordForUrl", async () => {
    const { worker } = await lockedWorker();
    const resp = await worker.generatePasswordForUrl("https://example.com/", 2, undefined, {
      fromPage: true,
    });
    expect(resp).toMatchObject({ locked: true });
    expect(resp.password).toBeUndefined();
  });

  it("ne rend plus la clef a la popup et le signale", async () => {
    const { send } = await lockedWorker();
    expect(await send({ action: "checkEncodingKey" })).toStrictEqual({
      hasEncodingKey: true,
      locked: true,
    });
    expect((await send({ action: "getEncodingKey" })).encodingKey).toBeNull();
  });

  it.each([
    ["getVault", {}],
    ["saveSite", { domain: "example.com" }],
    ["deleteEntry", { id: "x" }],
    ["previewChange", { id: "x" }],
    ["applyChange", { id: "x" }],
    ["exportVault", {}],
    ["importVault", { payload: "x" }],
    ["syncNow", {}],
    ["setEncodingKey", { encodingKey: OTHER_KEY }],
  ])("refuse %s", async (action, extra) => {
    const { send, session } = await lockedWorker();
    const resp = await send({ action, ...extra });
    expect(resp).toMatchObject({ ok: false, locked: true });
    expect(session.encodingKey).toBe(SESSION_KEY);
  });

  it("refuse l'enregistrement depuis la page", async () => {
    const { send } = await lockedWorker();
    const resp = await send({ action: "saveCurrentSite", login: "a" }, FROM_CONTENT_SCRIPT);
    expect(resp).toMatchObject({ ok: false, locked: true });
  });

  it("ne programme aucune synchronisation automatique", async () => {
    const { send } = await lockedWorker();
    expect(await send({ action: "syncAutoOpen" })).toStrictEqual({ ok: true, scheduled: false });
  });

  it("la grace de 3 minutes ne rouvre pas une session verrouillee", async () => {
    const { send, session } = loadWorker({ session: { encodingKey: SESSION_KEY } });
    await send({ action: "vaultSessionLeave" });
    expect(Number.isFinite(session[VAULT_SESSION_STORAGE_KEY])).toBe(true);
    await send({ action: "lockSession" });
    expect(session[VAULT_SESSION_STORAGE_KEY]).toBeUndefined();
    expect((await send({ action: "vaultSessionResume" })).unlocked).toBe(false);
    // Quitter l'ecran verrouille ne rearme pas la grace.
    await send({ action: "vaultSessionLeave" });
    expect((await send({ action: "vaultSessionResume" })).unlocked).toBe(false);
  });

  it("survit au recyclage du service worker", async () => {
    const { session } = await lockedWorker();
    expect(session.sessionLocked).toBe(true);
    const { send } = loadWorker({ session });
    expect((await send({ action: "checkEncodingKey" })).locked).toBe(true);
    expect((await send(generate)).locked).toBe(true);
  });

  it("une autre clef ne deverrouille pas", async () => {
    const { send } = await lockedWorker();
    expect(await send({ action: "vaultUnlock", encodingKey: OTHER_KEY })).toStrictEqual({
      ok: true,
      unlocked: false,
      reason: "otherKey",
    });
    expect((await send(generate)).locked).toBe(true);
  });

  it("la bonne clef rouvre toute la session", async () => {
    const { send, session } = await lockedWorker();
    expect(await send({ action: "vaultUnlock", encodingKey: SESSION_KEY })).toStrictEqual({
      ok: true,
      unlocked: true,
    });
    expect(session.sessionLocked).toBeUndefined();
    expect((await send({ action: "getEncodingKey" })).encodingKey).toBe(SESSION_KEY);
    const resp = await send(generate, FROM_CONTENT_SCRIPT);
    expect(resp.locked).toBeUndefined();
    expect(typeof resp.password).toBe("string");
  });

  it("« Effacer » oublie la clef, et le verrou avec elle", async () => {
    const { send, session } = await lockedWorker();
    expect(await send({ action: "clearEncodingKey" })).toStrictEqual({ ok: true });
    expect(session).toStrictEqual({});
    expect(await send({ action: "checkEncodingKey" })).toStrictEqual({
      hasEncodingKey: false,
      locked: false,
    });
    // Une nouvelle clef peut alors etre posee.
    expect((await send({ action: "setEncodingKey", encodingKey: OTHER_KEY })).ok).toBe(true);
    expect(typeof (await send(generate)).password).toBe("string");
  });

  it("sans clef, verrouiller ne verrouille rien", async () => {
    const { send, session } = loadWorker();
    expect(await send({ action: "lockSession" })).toStrictEqual({ ok: true, locked: false });
    expect(session.sessionLocked).toBeUndefined();
  });

  it("un content script ne peut pas verrouiller", async () => {
    const { send, session } = loadWorker({ session: { encodingKey: SESSION_KEY } });
    const resp = await send({ action: "lockSession" }, FROM_CONTENT_SCRIPT);
    expect(resp.error).toBeDefined();
    expect(session.sessionLocked).toBeUndefined();
  });
});

describe("menu injecte dans la page", () => {
  afterEach(() => {
    delete global.browser;
    delete global.chrome;
  });

  function loadContent(getMessage) {
    global.chrome = { i18n: { getMessage } };
    global.browser = global.chrome;
    jest.resetModules();
    return require(path.join(__dirname, "..", "content.js"));
  }

  it("dit que TheCode est verrouille quand la generation est refusee pour ca", () => {
    const { menuNotice } = loadContent(() => "");
    expect(menuNotice({ error: "x", locked: true })).toBe(
      "TheCode est verrouillé : ouvrez l'extension pour le déverrouiller",
    );
  });

  it("traduit le message", () => {
    const { menuNotice } = loadContent((key) => (key === "content_locked" ? "Locked" : ""));
    expect(menuNotice({ locked: true })).toBe("Locked");
  });

  it("garde le message « aucune clef » sinon", () => {
    const { menuNotice } = loadContent(() => "");
    expect(menuNotice({ error: "Aucune clé" })).toMatch(/Aucune clef/);
    expect(menuNotice(undefined)).toMatch(/Aucune clef/);
  });
});
