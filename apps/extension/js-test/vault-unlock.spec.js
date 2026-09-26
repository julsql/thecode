/**
 * Verrou de l'ecran carnet : il s'ouvre avec la clef maitresse, comparee a
 * celle de la session, ou posee comme clef de la session si aucune ne l'est.
 * Voir shared/spec/vault-lock.md.
 */
const fs = require("node:fs");
const path = require("node:path");
const { sameMasterKey, VAULT_SESSION_STORAGE_KEY } = require("../vault-session");

const SESSION_KEY = "clef-de-session";
const OTHER_KEY = "clef-differente";

function fakeArea(initial = {}) {
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

/** Recharge background.js avec des stockages simules. */
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
  require(path.join(__dirname, "..", "background.js"));
  const send = (request, sender = FROM_VAULT_PAGE) =>
    new Promise((resolve) => listeners[0](request, sender, resolve));
  return { send, local: localArea.store, session: sessionArea.store };
}

const FROM_VAULT_PAGE = { tab: { id: 3 }, url: "chrome-extension://x/vault-page.html" };
const FROM_CONTENT_SCRIPT = { tab: { id: 7 }, url: "https://example.com/" };

describe("comparaison des clefs", () => {
  it("reconnait la meme clef, y compris hors ASCII", () => {
    expect(sameMasterKey(SESSION_KEY, SESSION_KEY)).toBe(true);
    expect(sameMasterKey("clé ✓", "clé ✓")).toBe(true);
  });

  it("refuse une autre clef, un prefixe ou une valeur absente", () => {
    expect(sameMasterKey(SESSION_KEY, OTHER_KEY)).toBe(false);
    expect(sameMasterKey(SESSION_KEY, SESSION_KEY.slice(0, -1))).toBe(false);
    expect(sameMasterKey(SESSION_KEY.slice(0, -1), SESSION_KEY)).toBe(false);
    expect(sameMasterKey(SESSION_KEY, "")).toBe(false);
    expect(sameMasterKey(SESSION_KEY, undefined)).toBe(false);
    expect(sameMasterKey(null, SESSION_KEY)).toBe(false);
  });
});

describe("deverrouillage dans le service worker", () => {
  it("ouvre avec la clef de la session", async () => {
    const { send } = loadWorker({ session: { encodingKey: SESSION_KEY } });
    expect(await send({ action: "vaultUnlock", encodingKey: SESSION_KEY })).toStrictEqual({
      ok: true,
      unlocked: true,
    });
  });

  it("refuse une autre clef sans toucher a celle de la session", async () => {
    const { send, session } = loadWorker({ session: { encodingKey: SESSION_KEY } });
    expect(await send({ action: "vaultUnlock", encodingKey: OTHER_KEY })).toStrictEqual({
      ok: true,
      unlocked: false,
      reason: "otherKey",
    });
    expect(session.encodingKey).toBe(SESSION_KEY);
    expect((await send({ action: "getEncodingKey" })).encodingKey).toBe(SESSION_KEY);
  });

  it("nouvelle session : la clef saisie ouvre et devient celle de la session", async () => {
    const { send, local, session } = loadWorker();
    expect((await send({ action: "checkEncodingKey" })).hasEncodingKey).toBe(false);
    expect(await send({ action: "vaultUnlock", encodingKey: SESSION_KEY })).toStrictEqual({
      ok: true,
      unlocked: true,
      keySet: true,
    });
    expect(session.encodingKey).toBe(SESSION_KEY);
    expect((await send({ action: "getEncodingKey" })).encodingKey).toBe(SESSION_KEY);
    // Ni la clef ni une empreinte ne sont ecrites sur disque.
    expect(JSON.stringify(local)).not.toContain(SESSION_KEY);
    expect(Object.keys(local)).not.toContain("vaultLock");

    // Ensuite, une autre clef est refusee.
    expect((await send({ action: "vaultUnlock", encodingKey: OTHER_KEY })).unlocked).toBe(false);
  });

  it("refuse une saisie vide sans poser de clef", async () => {
    const { send, session } = loadWorker();
    for (const encodingKey of ["", undefined, 42]) {
      expect((await send({ action: "vaultUnlock", encodingKey })).ok).toBe(false);
    }
    expect(session.encodingKey).toBeUndefined();
  });

  it("refuse le deverrouillage a un content script", async () => {
    const { send, session } = loadWorker();
    const resp = await send(
      { action: "vaultUnlock", encodingKey: SESSION_KEY },
      FROM_CONTENT_SCRIPT,
    );
    expect(resp.error).toBeDefined();
    expect(resp.unlocked).toBeUndefined();
    expect(session.encodingKey).toBeUndefined();
  });

  it("efface l'ancien enregistrement du mot de passe de carnet au chargement", async () => {
    const { send, local } = loadWorker({
      local: { vaultLock: { v: 1, salt: "c2FsdA", hash: "aGFzaA" }, lengthNumber: 24 },
    });
    await send({ action: "checkEncodingKey" });
    expect(local.vaultLock).toBeUndefined();
    expect(local.lengthNumber).toBe(24);
  });

  it.each(["vaultLockStatus", "vaultLockCreate", "vaultLockVerify", "vaultLockForget"])(
    "n'a plus d'action %s",
    async (action) => {
      const { send } = loadWorker({ session: { encodingKey: SESSION_KEY } });
      const resp = await send({ action });
      expect(resp?.unlocked).toBeUndefined();
      expect(resp?.configured).toBeUndefined();
    },
  );

  it("la grace ne rouvre plus rien une fois la clef effacee", async () => {
    const { send, session } = loadWorker({ session: { encodingKey: SESSION_KEY } });
    await send({ action: "vaultSessionLeave" });
    expect(Number.isFinite(session[VAULT_SESSION_STORAGE_KEY])).toBe(true);
    await send({ action: "clearEncodingKey" });
    expect((await send({ action: "vaultSessionResume" })).unlocked).toBe(false);
  });
});

/** DOM minimal : de quoi faire tourner vault-page.js sans navigateur. */
function fakePage(ids) {
  const listeners = {};
  const on = (target) => (type, fn) => {
    (listeners[`${target}:${type}`] ||= []).push(fn);
  };
  const elements = {};
  for (const id of ids) {
    const attrs = {};
    elements[id] = {
      id,
      hidden: id !== "lockNow" && id !== "unlockNewSession" ? false : true,
      value: "",
      textContent: "",
      dataset: {},
      focus() {
        document.activeElement = this;
      },
      setAttribute: (k, v) => (attrs[k] = String(v)),
      removeAttribute: (k) => delete attrs[k],
      getAttribute: (k) => attrs[k] ?? null,
      addEventListener: on(id),
      replaceChildren() {},
      querySelector: () => null,
    };
  }
  const document = {
    activeElement: null,
    documentElement: {},
    visibilityState: "visible",
    getElementById: (id) => elements[id],
    querySelectorAll: () => [],
    addEventListener: on("document"),
  };
  const fire = async (target, type, event = {}) => {
    for (const fn of listeners[`${target}:${type}`] || []) {
      await fn({ preventDefault() {}, ...event });
    }
    await flush();
  };
  return { document, elements, fire, window: { addEventListener: on("window") } };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ecran carnet", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "vault-page.html"), "utf8");
  const ids = [...html.matchAll(/\bid="([A-Za-z]+)"/g)].map((m) => m[1]);

  /** Charge vault-page.js face a un service worker simule. */
  async function openPage({ sessionKey = null, resume = false } = {}) {
    const page = fakePage(ids);
    const sent = [];
    let key = sessionKey;
    const handle = (request) => {
      sent.push(request.action);
      switch (request.action) {
        case "checkEncodingKey":
          return { hasEncodingKey: Boolean(key) };
        case "vaultSessionResume":
          return { ok: true, unlocked: resume };
        case "vaultUnlock":
          if (!key) {
            key = request.encodingKey;
            return { ok: true, unlocked: true, keySet: true };
          }
          return request.encodingKey === key
            ? { ok: true, unlocked: true }
            : { ok: true, unlocked: false, reason: "otherKey" };
        case "getVault":
          return { ok: true, vault: { entries: [] } };
        default:
          return { ok: true };
      }
    };
    global.document = page.document;
    global.window = page.window;
    global.browser = {
      runtime: { sendMessage: (request, reply) => reply && reply(handle(request)) },
    };
    global.chrome = global.browser;
    jest.resetModules();
    require(path.join(__dirname, "..", "vault-page.js"));
    await flush();
    return { ...page, sent, getKey: () => key };
  }

  afterEach(() => {
    delete global.document;
    delete global.window;
  });

  it("ne propose plus ni creation, ni changement, ni oubli de mot de passe", () => {
    for (const id of ["createView", "forgotBtn", "forgetConfirm", "changeLockForm"]) {
      expect(ids).not.toContain(id);
    }
    expect(html).toMatch(/data-i18n="vault_unlock_hint"/);
    expect(html).toMatch(/<label for="unlockKey"/);
    // Le rappel « meme clef » reste au-dessus de la liste.
    expect(html.indexOf("sameKeyHint")).toBeLessThan(html.indexOf("entriesList"));
  });

  it("ouvre avec la clef de la session", async () => {
    const { elements, fire } = await openPage({ sessionKey: SESSION_KEY });
    expect(elements.unlockView.hidden).toBe(false);
    expect(elements.unlockNewSession.hidden).toBe(true);
    expect(global.document.activeElement.id).toBe("unlockKey");

    elements.unlockKey.value = SESSION_KEY;
    await fire("unlockView", "submit");
    expect(elements.unlockedView.hidden).toBe(false);
    expect(elements.unlockView.hidden).toBe(true);
    expect(elements.lockNow.hidden).toBe(false);
    expect(elements.unlockKey.value).toBe("");
  });

  it("refuse une autre clef en le disant", async () => {
    const { elements, fire } = await openPage({ sessionKey: SESSION_KEY });
    elements.unlockKey.value = OTHER_KEY;
    await fire("unlockView", "submit");
    expect(elements.unlockedView.hidden).toBe(true);
    expect(elements.unlockError.textContent).toMatch(/même clef/);
    expect(elements.unlockKey.getAttribute("aria-invalid")).toBe("true");
    expect(elements.unlockKey.value).toBe("");
  });

  it("nouvelle session : annonce que la clef saisie servira au generateur", async () => {
    const { elements, fire, getKey } = await openPage();
    expect(elements.unlockNewSession.hidden).toBe(false);
    elements.unlockKey.value = SESSION_KEY;
    await fire("unlockView", "submit");
    expect(elements.unlockedView.hidden).toBe(false);
    expect(getKey()).toBe(SESSION_KEY);
    expect(elements.pageStatus.textContent).toMatch(/générateur/);
  });

  it("rouvre sans rien demander dans la grace", async () => {
    const { elements } = await openPage({ sessionKey: SESSION_KEY, resume: true });
    expect(elements.unlockedView.hidden).toBe(false);
  });

  it("« Verrouiller » referme aussitot et efface la grace", async () => {
    const { elements, fire, sent } = await openPage({ sessionKey: SESSION_KEY, resume: true });
    await fire("lockNow", "click");
    expect(elements.unlockView.hidden).toBe(false);
    expect(elements.unlockedView.hidden).toBe(true);
    expect(elements.lockNow.hidden).toBe(true);
    expect(sent).toContain("vaultSessionClear");
  });
});
