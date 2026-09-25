// @vitest-environment node
//
// jsdom ne fournit pas Blob.stream(), dont dépend CompressionStream. Le code
// testé est bien du code de navigateur — c'est l'environnement de test qui est
// incomplet, et node expose la même API de flux.

/**
 * Export et import chiffrés d'un carnet.
 *
 * L'essentiel est l'interopérabilité : un carnet exporté depuis un appareil
 * doit être lisible par un autre, quelle que soit l'implémentation.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TransferError, exportVault, importVault } from "@/transfer";
import { emptyVault, newEntry, type Vault } from "@/vault";

const vector = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "transfer-vector.json"), "utf8"),
);
const v2Only = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "v2-only.json"), "utf8"),
) as { vault: Vault; expectedIds: string[] };

function filled(): Vault {
  const v = emptyVault();
  v.entries.push(
    newEntry("google.com", { domains: ["google.com", "google.fr"], login: "moi@example.com" }),
  );
  return v;
}

describe("transfert d'un carnet", () => {
  it("fait un aller-retour fidèle", async () => {
    const v = filled();
    expect(await importVault(await exportVault(v, "clef"), "clef")).toStrictEqual(v);
  });

  it("refuse une autre clef maîtresse plutôt que de rendre n'importe quoi", async () => {
    const payload = await exportVault(filled(), "clef");

    // AES-GCM authentifie : il refuse, il ne rend pas un contenu faux.
    await expect(importVault(payload, "mauvaise")).rejects.toThrow(TransferError);
  });

  it("refuse une version qu'il ne connaît pas", async () => {
    // Interpréter un format inconnu au hasard serait pire que refuser.
    await expect(importVault("TC9.aaa.bbb", "clef")).rejects.toThrow(/TC9/);
  });

  it("refuse un payload tronqué", async () => {
    await expect(importVault("TC1.seulement-deux", "clef")).rejects.toThrow(TransferError);
  });

  it("détecte une altération", async () => {
    const payload = await exportVault(filled(), "clef");
    const parts = payload.split(".");
    // Quatre caractères, pas un seul : en base64url, le dernier caractère ne
    // porte parfois que des bits ignorés au décodage — « Aw » et « Ax »
    // donnent le même octet. Changer ce seul caractère laissait donc le
    // chiffré intact, l'import réussissait, et le test échouait sans que rien
    // n'ait été altéré.
    const cipher = parts[2];
    const tail = cipher.slice(-4) === "AAAA" ? "BBBB" : "AAAA";
    const tampered = `${parts[0]}.${parts[1]}.${cipher.slice(0, -4)}${tail}`;

    await expect(importVault(tampered, "clef")).rejects.toThrow(TransferError);
  });

  it("ne réutilise jamais un nonce", async () => {
    // Réutiliser un nonce avec la même clef casse AES-GCM.
    const v = filled();
    const nonces = new Set<string>();
    for (let i = 0; i < 10; i++) {
      nonces.add((await exportVault(v, "clef")).split(".")[1]);
    }
    expect(nonces.size).toBe(10);
  });

  it("lit un payload produit par une autre implémentation", async () => {
    // Le fichier vient du CLI Python : c'est la seule garantie qui vaille.
    const imported = (await importVault(vector.payload, vector.masterKey)) as Vault;
    expect(imported.entries.length).toBeGreaterThan(0);
  });

  it("écarte à l'import les entrées v ≠ 2 (vecteur partagé)", async () => {
    // Le carnet n'accepte que la v2 : shared/spec/vault-merge.md.
    const payload = await exportVault(v2Only.vault, "clef");
    const imported = (await importVault(payload, "clef")) as Vault;
    expect(imported.entries.map((e) => e.id).sort()).toStrictEqual([...v2Only.expectedIds].sort());
  });

  it("produit un payload que les autres relisent", async () => {
    const payload = await exportVault(filled(), "clef");

    expect(payload.startsWith("TC1.")).toBe(true);
    // base64url sans remplissage : un « + » ou un « = » casserait les autres.
    expect(payload.split(".").slice(1).join("")).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
