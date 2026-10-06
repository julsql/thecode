/**
 * Clef maîtresse de la session et déverrouillage du carnet
 * (shared/spec/vault-lock.md).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  forgetMasterKey,
  keepMasterKey,
  KEPT_KEY,
  restoreMasterKey,
  locked,
  lockSession,
  masterKey,
  resetMasterKeyForTests,
  sameMasterKey,
  unlockWithMasterKey,
  usableMasterKey,
} from "@/masterKey";
import { VAULT_GRACE_MS, VAULT_SESSION_KEY } from "@/vaultSession";

const SESSION_KEY = "clef";
const OTHER_KEY = "autre clef";

beforeEach(() => {
  sessionStorage.clear();
  resetMasterKeyForTests();
});

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

describe("clef gardée le temps d'un rechargement", () => {
  const T0 = 1_000_000;

  /** La page se ferme avec la clef, la suivante démarre sans rien en mémoire. */
  function reload(leftAt = T0) {
    masterKey.value = SESSION_KEY;
    keepMasterKey(leftAt);
    resetMasterKeyForTests();
  }

  it("la reprend au chargement suivant, dans les 3 minutes", () => {
    reload();
    expect(restoreMasterKey(T0 + VAULT_GRACE_MS)).toBe(true);
    expect(masterKey.value).toBe(SESSION_KEY);
    expect(locked.value).toBe(false);
  });

  it("ne la laisse dans le stockage que le temps du rechargement", () => {
    reload();
    restoreMasterKey(T0 + 1);
    expect(sessionStorage.getItem(KEPT_KEY)).toBeNull();
  });

  it("l'oublie au-delà de 3 minutes, ou si l'horloge a reculé", () => {
    reload();
    expect(restoreMasterKey(T0 + VAULT_GRACE_MS + 1)).toBe(false);
    expect(masterKey.value).toBe("");
    expect(sessionStorage.getItem(KEPT_KEY)).toBeNull();

    reload();
    expect(restoreMasterKey(T0 - 1)).toBe(false);
    expect(masterKey.value).toBe("");
  });

  it("ne confie rien sans clef, ni session verrouillée", () => {
    keepMasterKey(T0);
    expect(sessionStorage.getItem(KEPT_KEY)).toBeNull();

    masterKey.value = SESSION_KEY;
    keepMasterKey(T0);
    lockSession();
    keepMasterKey(T0 + 1);
    expect(sessionStorage.getItem(KEPT_KEY)).toBeNull();
  });

  it("ignore une valeur altérée et un stockage inaccessible", () => {
    sessionStorage.setItem(KEPT_KEY, "{pas du json");
    expect(restoreMasterKey(T0)).toBe(false);
    sessionStorage.setItem(KEPT_KEY, JSON.stringify({ key: 12, leftAt: T0 }));
    expect(restoreMasterKey(T0)).toBe(false);
    expect(masterKey.value).toBe("");

    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    masterKey.value = SESSION_KEY;
    expect(() => keepMasterKey(T0, broken)).not.toThrow();
    resetMasterKeyForTests();
    expect(restoreMasterKey(T0, broken)).toBe(false);
    expect(restoreMasterKey(T0, null)).toBe(false);
  });
});
