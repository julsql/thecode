import { describe, it, expect, beforeEach, vi } from "vitest";
import { pbkdf2Sync } from "node:crypto";
import {
  LOCK_ITERATIONS,
  LOCK_STORAGE_KEY,
  LockError,
  changeLock,
  constantTimeEqual,
  createLock,
  deriveLockHash,
  forgetLock,
  fromBase64Url,
  hasLock,
  loadLock,
  toBase64Url,
  verifyLock,
} from "@/vaultLock";
import { VAULT_STORAGE_KEY } from "@/vault";

describe("encodage base64url", () => {
  it("fait l'aller-retour sans remplissage ni caractères + /", () => {
    const bytes = Uint8Array.from([0xfb, 0xff, 0xfe, 0x00, 0x01]);
    const encoded = toBase64Url(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(Array.from(fromBase64Url(encoded))).toEqual(Array.from(bytes));
  });
});

describe("comparaison en temps constant", () => {
  it("compare octet à octet", () => {
    expect(constantTimeEqual(Uint8Array.of(1, 2, 3), Uint8Array.of(1, 2, 3))).toBe(true);
    expect(constantTimeEqual(Uint8Array.of(1, 2, 3), Uint8Array.of(1, 2, 4))).toBe(false);
    expect(constantTimeEqual(Uint8Array.of(1, 2), Uint8Array.of(1, 2, 3))).toBe(false);
  });
});

describe("dérivation", () => {
  it("est PBKDF2-SHA256 sur 32 octets", async () => {
    const salt = Uint8Array.from({ length: 16 }, (_, i) => i);
    const expected = pbkdf2Sync("motdepasse", salt, 1000, 32, "sha256");
    const actual = await deriveLockHash("motdepasse", salt, 1000);
    expect(Array.from(actual)).toEqual(Array.from(expected));
  });

  it("utilise 600000 itérations par défaut", () => {
    expect(LOCK_ITERATIONS).toBe(600000);
  });
});

describe("verrou", () => {
  beforeEach(() => localStorage.clear());

  it("n'existe pas avant la première ouverture", () => {
    expect(hasLock()).toBe(false);
    expect(loadLock()).toBeNull();
  });

  it("refuse un mot de passe trop court ou mal recopié", async () => {
    await expect(createLock("court", "court")).rejects.toMatchObject({ code: "too-short" });
    await expect(createLock("assez long", "assez lonG")).rejects.toMatchObject({
      code: "mismatch",
    });
    expect(hasLock()).toBe(false);
  });

  it("stocke un sel et un hachage, jamais le mot de passe", async () => {
    await createLock("mot de passe", "mot de passe");
    const raw = localStorage.getItem(LOCK_STORAGE_KEY)!;
    expect(raw).not.toContain("mot de passe");

    const record = JSON.parse(raw);
    expect(record.v).toBe(1);
    expect(fromBase64Url(record.salt)).toHaveLength(16);
    expect(fromBase64Url(record.hash)).toHaveLength(32);
    const expected = pbkdf2Sync("mot de passe", fromBase64Url(record.salt), 600000, 32, "sha256");
    expect(record.hash).toBe(toBase64Url(new Uint8Array(expected)));
  });

  it("vérifie le bon mot de passe et refuse le mauvais", async () => {
    await createLock("mot de passe", "mot de passe");
    expect(await verifyLock("mot de passe")).toBe(true);
    expect(await verifyLock("mot de pass")).toBe(false);
  });

  it("change le mot de passe seulement avec l'actuel", async () => {
    await createLock("ancien mdp", "ancien mdp");
    await expect(changeLock("faux mdp", "nouveau mdp", "nouveau mdp")).rejects.toBeInstanceOf(
      LockError,
    );
    await changeLock("ancien mdp", "nouveau mdp", "nouveau mdp");
    expect(await verifyLock("nouveau mdp")).toBe(true);
    expect(await verifyLock("ancien mdp")).toBe(false);
  }, 20000);

  it("efface le carnet local et le verrou quand on oublie", async () => {
    await createLock("mot de passe", "mot de passe");
    localStorage.setItem(VAULT_STORAGE_KEY, "{}");
    forgetLock();
    expect(hasLock()).toBe(false);
    expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBeNull();
  });

  it("ignore un verrou illisible", () => {
    localStorage.setItem(LOCK_STORAGE_KEY, "pas du json");
    expect(loadLock()).toBeNull();
    localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify({ v: 2, salt: "a", hash: "b" }));
    expect(loadLock()).toBeNull();
  });

  it("ne casse pas quand le stockage est indisponible", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqué");
    });
    expect(hasLock()).toBe(false);
    spy.mockRestore();
  });
});
