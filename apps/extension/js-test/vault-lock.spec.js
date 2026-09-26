/**
 * Verrou de l'ecran carnet : empreinte du mot de passe et parcours complets
 * (creation, deverrouillage, changement, oubli) cote service worker.
 */
const path = require("node:path");
const {
  VAULT_LOCK_ITERATIONS,
  VAULT_LOCK_STORAGE_KEY,
  base64urlEncode,
  base64urlDecode,
  timingSafeEqual,
  vaultLockPasswordError,
  hashVaultPassword,
  verifyVaultPassword,
} = require("../vault-lock");
const { newPasswordError } = require("../vault-page");

describe("empreinte du mot de passe de carnet", () => {
  it("suit la spec : PBKDF2-SHA256, 600000 iterations", () => {
    expect(VAULT_LOCK_ITERATIONS).toBe(600000);
  });

  it("rend { v, salt, hash } en base64url, sel de 16 octets, hash de 32", async () => {
    const record = await hashVaultPassword("correct horse", 1000);
    expect(Object.keys(record).sort()).toStrictEqual(["hash", "salt", "v"]);
    expect(record.v).toBe(1);
    expect(record.salt).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(record.hash).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(base64urlDecode(record.salt)).toHaveLength(16);
    expect(base64urlDecode(record.hash)).toHaveLength(32);
  });

  it("ne stocke jamais le mot de passe et sale chaque empreinte", async () => {
    const a = await hashVaultPassword("correct horse", 1000);
    const b = await hashVaultPassword("correct horse", 1000);
    expect(JSON.stringify(a)).not.toContain("correct horse");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("derive le vecteur PBKDF2-HMAC-SHA256 de reference", async () => {
    // RFC 7914 / vecteurs publics : P="password", S="salt", c=1, dkLen=32.
    const record = {
      v: 1,
      salt: base64urlEncode(new TextEncoder().encode("salt")),
      hash: base64urlEncode(
        Buffer.from("120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b", "hex"),
      ),
    };
    expect(await verifyVaultPassword("password", record, 1)).toBe(true);
    expect(await verifyVaultPassword("Password", record, 1)).toBe(false);
  });

  it("verifie le bon mot de passe et refuse les autres", async () => {
    const record = await hashVaultPassword("correct horse", 1000);
    expect(await verifyVaultPassword("correct horse", record, 1000)).toBe(true);
    expect(await verifyVaultPassword("correct horsE", record, 1000)).toBe(false);
    expect(await verifyVaultPassword("", record, 1000)).toBe(false);
    expect(await verifyVaultPassword(undefined, record, 1000)).toBe(false);
  });

  it("refuse un enregistrement absent, d'une autre version ou illisible", async () => {
    const record = await hashVaultPassword("correct horse", 1000);
    expect(await verifyVaultPassword("correct horse", null, 1000)).toBe(false);
    expect(await verifyVaultPassword("correct horse", { ...record, v: 2 }, 1000)).toBe(false);
    expect(await verifyVaultPassword("correct horse", { ...record, salt: "%%" }, 1000)).toBe(false);
  });

  it("aller-retour base64url sans padding", () => {
    const bytes = Uint8Array.from([0, 250, 251, 252, 253, 254, 255]);
    const text = base64urlEncode(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect([...base64urlDecode(text)]).toStrictEqual([...bytes]);
  });

  it("compare en temps constant", () => {
    expect(timingSafeEqual(Uint8Array.of(1, 2, 3), Uint8Array.of(1, 2, 3))).toBe(true);
    expect(timingSafeEqual(Uint8Array.of(1, 2, 3), Uint8Array.of(1, 2, 4))).toBe(false);
    expect(timingSafeEqual(Uint8Array.of(1, 2, 3), Uint8Array.of(1, 2))).toBe(false);
  });

  it("exige 8 caracteres", () => {
    expect(vaultLockPasswordError("1234567")).toMatch(/8/);
    expect(vaultLockPasswordError(undefined)).toMatch(/8/);
    expect(vaultLockPasswordError("12345678")).toBeNull();
  });

  it("exige deux saisies identiques dans la page", () => {
    expect(newPasswordError("court", "court")).toMatch(/8/);
    expect(newPasswordError("12345678", "12345679")).toMatch(/correspondent/);
    expect(newPasswordError("12345678", "12345678")).toBeNull();
  });
});

/** Recharge background.js avec un stockage simule. */
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
  const send = (request, sender = {}) =>
    new Promise((resolve) => listeners[0](request, sender, resolve));
  return { send, store };
}

const FROM_CONTENT_SCRIPT = { tab: { id: 7 }, url: "https://example.com/" };

describe("parcours du verrou", () => {
  // 600000 iterations reelles : chaque derivation coute quelques centaines de
  // millisecondes.
  jest.setTimeout(30000);

  it("premiere ouverture : cree le mot de passe, puis deverrouille avec lui", async () => {
    const { send, store } = loadWorker();
    expect(await send({ action: "vaultLockStatus" })).toStrictEqual({
      ok: true,
      configured: false,
    });

    expect((await send({ action: "vaultLockCreate", password: "court" })).ok).toBe(false);
    expect(store[VAULT_LOCK_STORAGE_KEY]).toBeUndefined();

    expect(await send({ action: "vaultLockCreate", password: "motdepasse" })).toStrictEqual({
      ok: true,
    });
    expect(store[VAULT_LOCK_STORAGE_KEY].v).toBe(1);
    expect(JSON.stringify(store)).not.toContain("motdepasse");
    expect((await send({ action: "vaultLockStatus" })).configured).toBe(true);

    expect(await send({ action: "vaultLockVerify", password: "motdepasse" })).toStrictEqual({
      ok: true,
      unlocked: true,
    });
    expect((await send({ action: "vaultLockVerify", password: "autrechose" })).unlocked).toBe(
      false,
    );

    // Deja pose : il ne se remplace pas sans l'actuel.
    expect((await send({ action: "vaultLockCreate", password: "nouveaumdp" })).ok).toBe(false);
  });

  it("change le mot de passe seulement avec l'actuel", async () => {
    const record = await hashVaultPassword("ancienmdp");
    const { send } = loadWorker({ [VAULT_LOCK_STORAGE_KEY]: record });

    const refused = await send({ action: "vaultLockChange", current: "faux", next: "nouveaumdp" });
    expect(refused.ok).toBe(false);

    const tooShort = await send({ action: "vaultLockChange", current: "ancienmdp", next: "court" });
    expect(tooShort.ok).toBe(false);

    expect(
      await send({ action: "vaultLockChange", current: "ancienmdp", next: "nouveaumdp" }),
    ).toStrictEqual({ ok: true });
    expect((await send({ action: "vaultLockVerify", password: "ancienmdp" })).unlocked).toBe(false);
    expect((await send({ action: "vaultLockVerify", password: "nouveaumdp" })).unlocked).toBe(true);
  });

  it("l'oubli efface le carnet local et le verrou, rien d'autre", async () => {
    const { send, store } = loadWorker({
      [VAULT_LOCK_STORAGE_KEY]: { v: 1, salt: "AAAA", hash: "AAAA" },
      vault: { schema: 1, updatedAt: "2026-01-01T00:00:00Z", entries: [] },
      syncSession: { endpoint: "https://x" },
      lengthNumber: 24,
    });
    expect(await send({ action: "vaultLockForget" })).toStrictEqual({ ok: true });
    expect(store.vault).toBeUndefined();
    expect(store[VAULT_LOCK_STORAGE_KEY]).toBeUndefined();
    expect(store.syncSession).toBeDefined();
    expect(store.lengthNumber).toBe(24);
    expect((await send({ action: "vaultLockStatus" })).configured).toBe(false);
  });

  it("refuse toutes les actions du verrou a un content script", async () => {
    const { send, store } = loadWorker({
      [VAULT_LOCK_STORAGE_KEY]: { v: 1, salt: "AAAA", hash: "AAAA" },
      vault: { schema: 1, updatedAt: "2026-01-01T00:00:00Z", entries: [] },
    });
    for (const action of [
      "vaultLockStatus",
      "vaultLockCreate",
      "vaultLockVerify",
      "vaultLockChange",
      "vaultLockForget",
    ]) {
      const res = await send({ action, password: "motdepasse" }, FROM_CONTENT_SCRIPT);
      expect(res.error).toBeDefined();
      expect(res.ok).toBeUndefined();
    }
    expect(store.vault).toBeDefined();
    expect(store[VAULT_LOCK_STORAGE_KEY]).toBeDefined();
  });
});
