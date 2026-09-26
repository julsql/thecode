/**
 * Grâce de 3 minutes de l'écran carnet (shared/spec/vault-lock.md, « Session »).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  VAULT_GRACE_MS,
  VAULT_SESSION_KEY,
  clearSession,
  isWithinGrace,
  recordLeave,
  resumeSession,
} from "@/vaultSession";

const T0 = 1_800_000_000_000;

beforeEach(() => sessionStorage.clear());

describe("fenêtre de grâce", () => {
  it("dure 3 minutes, comme celle de la clef", () => {
    expect(VAULT_GRACE_MS).toBe(180_000);
  });

  it("laisse ouvert dans les 3 minutes, bornes comprises", () => {
    expect(isWithinGrace(T0, T0)).toBe(true);
    expect(isWithinGrace(T0, T0 + 60_000)).toBe(true);
    expect(isWithinGrace(T0, T0 + VAULT_GRACE_MS)).toBe(true);
  });

  it("referme au-delà", () => {
    expect(isWithinGrace(T0, T0 + VAULT_GRACE_MS + 1)).toBe(false);
  });

  it("referme si l'horloge recule", () => {
    expect(isWithinGrace(T0, T0 - 1)).toBe(false);
  });

  it("referme sans instant de sortie valable", () => {
    expect(isWithinGrace(null, T0)).toBe(false);
    expect(isWithinGrace(Number.NaN, T0)).toBe(false);
  });
});

describe("session dans sessionStorage", () => {
  it("n'y met qu'un horodatage", () => {
    recordLeave(T0);
    expect(sessionStorage.length).toBe(1);
    expect(sessionStorage.getItem(VAULT_SESSION_KEY)).toBe(String(T0));
  });

  it("rouvre dans la grâce", () => {
    recordLeave(T0);
    expect(resumeSession(T0 + 179_000)).toBe(true);
  });

  it("referme au-delà et oublie l'instant", () => {
    recordLeave(T0);
    expect(resumeSession(T0 + VAULT_GRACE_MS + 1)).toBe(false);
    expect(sessionStorage.getItem(VAULT_SESSION_KEY)).toBeNull();
  });

  it("referme si l'horloge recule", () => {
    recordLeave(T0);
    expect(resumeSession(T0 - 1000)).toBe(false);
  });

  it("« Verrouiller » efface l'instant aussitôt", () => {
    recordLeave(T0);
    clearSession();
    expect(resumeSession(T0 + 1)).toBe(false);
  });

  it("reste fermé sans sortie enregistrée ou avec une valeur altérée", () => {
    expect(resumeSession(T0)).toBe(false);
    sessionStorage.setItem(VAULT_SESSION_KEY, "demain");
    expect(resumeSession(T0)).toBe(false);
  });

  it("reste fermé si le stockage est inaccessible", () => {
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
    expect(() => recordLeave(T0, broken)).not.toThrow();
    expect(resumeSession(T0, broken)).toBe(false);
    expect(() => clearSession(broken)).not.toThrow();
    expect(resumeSession(T0, null)).toBe(false);
  });
});
