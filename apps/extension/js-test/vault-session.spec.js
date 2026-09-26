/**
 * Grace de 3 minutes de l'ecran carnet (shared/spec/vault-lock.md, « Session »).
 */
const path = require("node:path");
const {
  VAULT_SESSION_GRACE_MS,
  VAULT_SESSION_STORAGE_KEY,
  isWithinVaultGrace,
  createVaultSession,
} = require("../vault-session");

const T0 = 1_800_000_000_000;

describe("fenetre de grace", () => {
  it("dure 3 minutes, comme celle de la clef", () => {
    expect(VAULT_SESSION_GRACE_MS).toBe(180_000);
  });

  it("laisse ouvert dans les 3 minutes, bornes comprises", () => {
    expect(isWithinVaultGrace(T0, T0)).toBe(true);
    expect(isWithinVaultGrace(T0, T0 + 60_000)).toBe(true);
    expect(isWithinVaultGrace(T0, T0 + VAULT_SESSION_GRACE_MS)).toBe(true);
  });

  it("referme au-dela", () => {
    expect(isWithinVaultGrace(T0, T0 + VAULT_SESSION_GRACE_MS + 1)).toBe(false);
  });

  it("referme si l'horloge recule", () => {
    expect(isWithinVaultGrace(T0, T0 - 1)).toBe(false);
  });

  it("referme sans instant de sortie valable", () => {
    expect(isWithinVaultGrace(null, T0)).toBe(false);
    expect(isWithinVaultGrace(undefined, T0)).toBe(false);
    expect(isWithinVaultGrace("1800000000000", T0)).toBe(false);
    expect(isWithinVaultGrace(NaN, T0)).toBe(false);
  });
});

function fakeArea() {
  const store = {};
  return {
    store,
    get: async (keys) =>
      Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]])),
    set: async (obj) => Object.assign(store, obj),
    remove: async (keys) => keys.forEach((k) => delete store[k]),
  };
}

describe.each([
  ["storage.session", () => fakeArea()],
  ["memoire du fond", () => undefined],
])("session (%s)", (_, makeArea) => {
  it("rouvre dans la grace", async () => {
    const session = createVaultSession(makeArea());
    await session.leave(T0);
    expect(await session.resume(T0 + 120_000)).toBe(true);
  });

  it("referme au-dela et oublie l'instant", async () => {
    const session = createVaultSession(makeArea());
    await session.leave(T0);
    expect(await session.resume(T0 + VAULT_SESSION_GRACE_MS + 1)).toBe(false);
    expect(await session.resume(T0)).toBe(false);
  });

  it("referme si l'horloge recule", async () => {
    const session = createVaultSession(makeArea());
    await session.leave(T0);
    expect(await session.resume(T0 - 1000)).toBe(false);
  });

  it("« Verrouiller » efface l'instant aussitot", async () => {
    const session = createVaultSession(makeArea());
    await session.leave(T0);
    await session.clear();
    expect(await session.resume(T0 + 1)).toBe(false);
  });

  it("reste ferme sans sortie enregistree", async () => {
    expect(await createVaultSession(makeArea()).resume(T0)).toBe(false);
  });
});

describe("stockage de session", () => {
  it("n'y met qu'un horodatage", async () => {
    const area = fakeArea();
    await createVaultSession(area).leave(T0);
    expect(area.store).toStrictEqual({ [VAULT_SESSION_STORAGE_KEY]: T0 });
  });

  it("survit a un redemarrage du service worker", async () => {
    const area = fakeArea();
    await createVaultSession(area).leave(T0);
    expect(await createVaultSession(area).resume(T0 + 1000)).toBe(true);
  });

  it("se replie sur la memoire si le stockage echoue", async () => {
    const broken = {
      get: async () => {
        throw new Error("indisponible");
      },
      set: async () => {
        throw new Error("indisponible");
      },
      remove: async () => {
        throw new Error("indisponible");
      },
    };
    const session = createVaultSession(broken);
    await session.leave(T0);
    expect(await session.resume(T0 + 1000)).toBe(true);
  });
});

// Cablage dans le service worker : actions reservees aux pages de l'extension.
function loadWorker({ local = {}, withSession = true } = {}) {
  const store = { ...local };
  const session = withSession ? fakeArea() : undefined;
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
      ...(session ? { session } : {}),
      onChanged: { addListener: () => {} },
    },
  };
  global.browser = global.chrome;
  jest.resetModules();
  require(path.join(__dirname, "..", "background.js"));
  const send = (request, sender = FROM_VAULT_PAGE) =>
    new Promise((resolve) => listeners[0](request, sender, resolve));
  return { send, store, session };
}

const FROM_VAULT_PAGE = { tab: { id: 3 }, url: "chrome-extension://x/vault-page.html" };
const FROM_CONTENT_SCRIPT = { tab: { id: 7 }, url: "https://example.com/" };
const LOCK = { vaultLock: { v: 1, salt: "c2FsdA", hash: "aGFzaA" } };

describe("session dans le service worker", () => {
  let now;
  beforeEach(() => {
    now = T0;
    jest.spyOn(Date, "now").mockImplementation(() => now);
  });
  afterEach(() => jest.restoreAllMocks());

  it("rouvre l'ecran quitte il y a moins de 3 minutes", async () => {
    const { send, session } = loadWorker({ local: LOCK });
    await send({ action: "vaultSessionLeave" });
    expect(session.store).toStrictEqual({ [VAULT_SESSION_STORAGE_KEY]: T0 });
    now = T0 + 179_000;
    expect(await send({ action: "vaultSessionResume" })).toStrictEqual({
      ok: true,
      unlocked: true,
    });
  });

  it("redemande le mot de passe au-dela", async () => {
    const { send } = loadWorker({ local: LOCK });
    await send({ action: "vaultSessionLeave" });
    now = T0 + VAULT_SESSION_GRACE_MS + 1;
    expect((await send({ action: "vaultSessionResume" })).unlocked).toBe(false);
  });

  it("referme si l'horloge recule", async () => {
    const { send } = loadWorker({ local: LOCK });
    await send({ action: "vaultSessionLeave" });
    now = T0 - 60_000;
    expect((await send({ action: "vaultSessionResume" })).unlocked).toBe(false);
  });

  it("« Verrouiller » referme aussitot", async () => {
    const { send } = loadWorker({ local: LOCK });
    await send({ action: "vaultSessionLeave" });
    await send({ action: "vaultSessionClear" });
    expect((await send({ action: "vaultSessionResume" })).unlocked).toBe(false);
  });

  it("« Mot de passe oublie » referme aussitot", async () => {
    const { send, session } = loadWorker({ local: LOCK });
    await send({ action: "vaultSessionLeave" });
    await send({ action: "vaultLockForget" });
    expect(session.store).toStrictEqual({});
    expect((await send({ action: "vaultSessionResume" })).unlocked).toBe(false);
  });

  it("ne rouvre rien sans mot de passe de carnet", async () => {
    const { send, session } = loadWorker();
    await send({ action: "vaultSessionLeave" });
    expect(session.store).toStrictEqual({});
    expect((await send({ action: "vaultSessionResume" })).unlocked).toBe(false);
  });

  it("garde l'instant en memoire sans storage.session", async () => {
    const { send, store } = loadWorker({ local: LOCK, withSession: false });
    await send({ action: "vaultSessionLeave" });
    expect(store[VAULT_SESSION_STORAGE_KEY]).toBeUndefined();
    now = T0 + 1000;
    expect((await send({ action: "vaultSessionResume" })).unlocked).toBe(true);
  });

  it.each(["vaultSessionLeave", "vaultSessionResume", "vaultSessionClear"])(
    "refuse %s a un content script",
    async (action) => {
      const { send, session } = loadWorker({ local: LOCK });
      const resp = await send({ action }, FROM_CONTENT_SCRIPT);
      expect(resp.error).toBeDefined();
      expect(resp.unlocked).toBeUndefined();
      expect(session.store).toStrictEqual({});
    },
  );

  it("un content script ne prolonge pas la grace", async () => {
    const { send } = loadWorker({ local: LOCK });
    await send({ action: "vaultSessionLeave" });
    now = T0 + VAULT_SESSION_GRACE_MS;
    await send({ action: "vaultSessionLeave" }, FROM_CONTENT_SCRIPT);
    now = T0 + VAULT_SESSION_GRACE_MS + 1;
    expect((await send({ action: "vaultSessionResume" })).unlocked).toBe(false);
  });
});
