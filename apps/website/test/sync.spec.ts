/**
 * Client de synchronisation.
 *
 * L'essentiel ici est l'interopérabilité : un carnet chiffré par le site doit
 * être lisible par le CLI et l'extension, sinon la synchronisation entre
 * appareils ne veut rien dire.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KDF_ITERATIONS, KDF_SALT, deriveTransferKey } from "@/transfer";
import { clearSession, loadSession, saveSession, SyncError } from "@/sync";

const vector = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "transfer-vector.json"), "utf8"),
);

describe("clef de transfert", () => {
  it("utilise le sel et le coût de la spécification partagée", () => {
    // Un sel différent d'une implémentation à l'autre rendrait les carnets
    // mutuellement illisibles, sans que rien ne le signale.
    expect(KDF_SALT).toBe("thecode-transfer/v1");
    expect(KDF_ITERATIONS).toBe(600000);
  });

  it("déchiffre un payload produit par une autre implémentation", async () => {
    const key = await deriveTransferKey(vector.masterKey);

    const raw = vector.payload.split(".");
    const b64d = (t: string) => {
      const s = t.replace(/-/g, "+").replace(/_/g, "/");
      const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
      return Uint8Array.from(bin, (c) => c.charCodeAt(0));
    };

    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64d(raw[1]) },
      key,
      b64d(raw[2]),
    );

    // Le payload partagé est compressé : on vérifie que le déchiffrement
    // aboutit, la décompression étant couverte côté CLI.
    expect(new Uint8Array(plain).length).toBeGreaterThan(0);
  });
});

describe("session", () => {
  beforeEach(() => clearSession());

  it("survit à un rechargement", () => {
    saveSession({ endpoint: "https://x", accessToken: "a", refreshToken: "r" });
    expect(loadSession()?.accessToken).toBe("a");
  });

  it("rend null quand il n'y en a pas", () => {
    expect(loadSession()).toBeNull();
  });

  it("s'oublie à la déconnexion", () => {
    saveSession({ endpoint: "https://x", accessToken: "a", refreshToken: "r" });
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it("ne casse pas sur un contenu corrompu", () => {
    // Mode privé, stockage bricolé : la page doit continuer de fonctionner.
    localStorage.setItem("thecode.session", "pas du json");
    expect(loadSession()).toBeNull();
  });
});

describe("erreurs", () => {
  it("expose un type dédié", () => {
    expect(new SyncError("x")).toBeInstanceOf(Error);
  });
});
