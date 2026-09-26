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
import {
  TransferError,
  deriveTransferBits,
  exportVault,
  importVault,
  joinFragments,
  splitPayload,
} from "@/transfer";
import { emptyVault, newEntry, type Vault } from "@/vault";

const vector = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "transfer-vector.json"), "utf8"),
);

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
    await expect(importVault("TC9.aaa.bbb.ccc", "clef")).rejects.toThrow(/TC9/);
  });

  it("refuse un payload tronqué", async () => {
    await expect(importVault("TC2.seulement-deux", "clef")).rejects.toThrow(TransferError);
    const [, salt, nonce] = (await exportVault(filled(), "clef")).split(".");
    await expect(importVault(`TC2.${salt}.${nonce}`, "clef")).rejects.toThrow(/inattendu/);
  });

  it("refuse un sel ou un nonce de mauvaise taille avant de déchiffrer", async () => {
    const [, salt, nonce, cipher] = (await exportVault(filled(), "clef")).split(".");
    await expect(importVault(`TC2.${salt!.slice(4)}.${nonce}.${cipher}`, "clef")).rejects.toThrow(
      /16 octets/,
    );
    await expect(importVault(`TC2.${salt}.${nonce!.slice(4)}.${cipher}`, "clef")).rejects.toThrow(
      /16 octets/,
    );
  });

  it("détecte une altération", async () => {
    const payload = await exportVault(filled(), "clef");
    const parts = payload.split(".");
    // Quatre caractères, pas un seul : en base64url, le dernier caractère ne
    // porte parfois que des bits ignorés au décodage — « Aw » et « Ax »
    // donnent le même octet. Changer ce seul caractère laissait donc le
    // chiffré intact, l'import réussissait, et le test échouait sans que rien
    // n'ait été altéré.
    const cipher = parts[3]!;
    const tail = cipher.slice(-4) === "AAAA" ? "BBBB" : "AAAA";
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]}.${cipher.slice(0, -4)}${tail}`;

    await expect(importVault(tampered, "clef")).rejects.toThrow(TransferError);
  });

  it("ne réutilise jamais un sel ni un nonce", async () => {
    // Réutiliser un nonce avec la même clef casse AES-GCM.
    const v = filled();
    const salts = new Set<string>();
    const nonces = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const [, salt, nonce] = (await exportVault(v, "clef")).split(".");
      salts.add(salt!);
      nonces.add(nonce!);
    }
    expect(salts.size).toBe(5);
    expect(nonces.size).toBe(5);
  });

  it("lit un payload produit par une autre implémentation", async () => {
    // Le fichier vient du CLI Python : c'est la seule garantie qui vaille.
    expect(await importVault(vector.payload, vector.masterKey)).toStrictEqual(vector.vault);
  });

  it("dérive la même clef de transfert", async () => {
    const salt = new Uint8Array(Buffer.from(vector.payload.split(".")[1], "base64url"));
    const bits = await deriveTransferBits(vector.masterKey, salt);
    expect(Buffer.from(bits).toString("hex")).toBe(vector.derivedTransferHex);
  });

  it("couvre chaque cas refusé", () => {
    expect(vector.rejected.map((c: { name: string }) => c.name)).toContain("tc1");
  });

  it.each((vector.rejected as Array<{ name: string; payload: string }>).map((c) => [c.name, c]))(
    "refuse %s",
    async (_name, c) => {
      await expect(importVault(c.payload, vector.masterKey)).rejects.toThrow(TransferError);
    },
  );

  it("produit un payload que les autres relisent", async () => {
    const payload = await exportVault(filled(), "clef");

    expect(payload.startsWith("TC2.")).toBe(true);
    // base64url sans remplissage : un « + » ou un « = » casserait les autres.
    expect(payload.split(".").slice(1).join("")).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("découpage en plusieurs QR", () => {
  const payload = `TC2.${"a".repeat(22)}.${"b".repeat(16)}.${"c".repeat(6000)}`;

  it("laisse un payload court en un seul code", () => {
    expect(splitPayload("TC2.sel.nonce.data")).toStrictEqual(["TC2.sel.nonce.data"]);
  });

  it("coupe le corps en morceaux de 2600 caractères", () => {
    const fragments = splitPayload(payload);
    expect(fragments).toHaveLength(3);
    expect(fragments[0]!.startsWith("TC2m.0.3.aaaaaaaaaaaaaaaaaaaaaa.bbbb")).toBe(true);
    expect(fragments[0]!.length).toBe("TC2m.0.3.".length + 2600);
    expect(fragments[2]!.startsWith("TC2m.2.3.")).toBe(true);
  });

  it("réassemble dans le désordre, doublons et index hors bornes ignorés", () => {
    const [a, b, c] = splitPayload(payload) as [string, string, string];
    expect(joinFragments([c, a])).toBeNull();
    expect(joinFragments([c, a, a, "TC2m.7.3.zzz", b])).toBe(payload);
  });

  it("refuse les codes v1", () => {
    expect(() => joinFragments(["TC1m.0.2.abc"])).toThrow(TransferError);
    expect(() => joinFragments(["TC1.abc.def"])).toThrow(TransferError);
  });
});
