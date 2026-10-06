/**
 * Clef maîtresse de la session et déverrouillage du carnet
 * (shared/spec/vault-lock.md).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  forgetMasterKey,
  locked,
  lockSession,
  masterKey,
  resetMasterKeyForTests,
  sameMasterKey,
  unlockWithMasterKey,
  usableMasterKey,
} from "@/masterKey";
import { VAULT_SESSION_KEY } from "@/vaultSession";

const SESSION_KEY = "clef";
const OTHER_KEY = "autre clef";

beforeEach(() => resetMasterKeyForTests());

describe("comparaison des clefs", () => {
  it("reconnaît la même clef, y compris hors ASCII", () => {
    expect(sameMasterKey(SESSION_KEY, SESSION_KEY)).toBe(true);
    expect(sameMasterKey("clé ✓", "clé ✓")).toBe(true);
  });

  it("refuse une autre clef ou un préfixe", () => {
    expect(sameMasterKey(SESSION_KEY, OTHER_KEY)).toBe(false);
    expect(sameMasterKey(SESSION_KEY, SESSION_KEY.slice(0, -1))).toBe(false);
    expect(sameMasterKey(SESSION_KEY.slice(0, -1), SESSION_KEY)).toBe(false);
    expect(sameMasterKey(SESSION_KEY, "")).toBe(false);
  });
});

describe("déverrouillage", () => {
  it("nouvelle session : la clef saisie devient celle de la session", () => {
    expect(unlockWithMasterKey(SESSION_KEY)).toBe("keySet");
    expect(masterKey.value).toBe(SESSION_KEY);
  });

  it("ouvre avec la clef de la session", () => {
    masterKey.value = SESSION_KEY;
    expect(unlockWithMasterKey(SESSION_KEY)).toBe("unlocked");
  });

  it("refuse une autre clef sans toucher à celle de la session", () => {
    masterKey.value = SESSION_KEY;
    expect(unlockWithMasterKey(OTHER_KEY)).toBe("otherKey");
    expect(masterKey.value).toBe(SESSION_KEY);
  });

  it("refuse une saisie vide", () => {
    expect(unlockWithMasterKey("")).toBe("empty");
    expect(masterKey.value).toBe("");
  });
});

describe("verrou de la session", () => {
  it("garde la clef mais la rend inutilisable", () => {
    masterKey.value = SESSION_KEY;
    expect(lockSession()).toBe(true);
    expect(locked.value).toBe(true);
    expect(masterKey.value).toBe(SESSION_KEY);
    expect(usableMasterKey.value).toBe("");
  });

  it("efface la grâce de l'écran carnet", () => {
    masterKey.value = SESSION_KEY;
    sessionStorage.setItem(VAULT_SESSION_KEY, String(Date.now()));
    lockSession();
    expect(sessionStorage.getItem(VAULT_SESSION_KEY)).toBeNull();
  });

  it("sans clef, ne verrouille rien", () => {
    expect(lockSession()).toBe(false);
    expect(locked.value).toBe(false);
  });

  it("une autre clef ne déverrouille pas", () => {
    masterKey.value = SESSION_KEY;
    lockSession();
    expect(unlockWithMasterKey(OTHER_KEY)).toBe("otherKey");
    expect(locked.value).toBe(true);
    expect(unlockWithMasterKey("")).toBe("empty");
    expect(locked.value).toBe(true);
  });

  it("la clef de la session déverrouille tout", () => {
    masterKey.value = SESSION_KEY;
    lockSession();
    expect(unlockWithMasterKey(SESSION_KEY)).toBe("unlocked");
    expect(locked.value).toBe(false);
    expect(usableMasterKey.value).toBe(SESSION_KEY);
  });

  it("« Effacer » oublie la clef et le verrou", () => {
    masterKey.value = SESSION_KEY;
    lockSession();
    forgetMasterKey();
    expect(masterKey.value).toBe("");
    expect(locked.value).toBe(false);
  });
});
