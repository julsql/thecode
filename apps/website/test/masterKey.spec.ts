/**
 * Clef maîtresse de la session et déverrouillage du carnet
 * (shared/spec/vault-lock.md).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { masterKey, resetMasterKeyForTests, sameMasterKey, unlockWithMasterKey } from "@/masterKey";

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
