/**
 * Export et import chiffres du carnet.
 *
 * Verifie aussi l'interoperabilite avec le CLI : un carnet exporte depuis un
 * appareil doit pouvoir etre lu par un autre, quelle que soit l'implementation.
 */
const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;

const {
  exportVault,
  importVault,
  deriveTransferBits,
  splitPayload,
  joinFragments,
  TRANSFER_PREFIX,
} = require("../transfer");
const { emptyVault, newEntry, mergeVaults } = require("../vault");

function filled() {
  const v = emptyVault();
  v.entries.push(
    newEntry("google.com", { domains: ["google.com", "google.fr"], login: "moi@example.com" }),
  );
  return v;
}

describe("transfert chiffre", () => {
  it("fait un aller-retour fidele", async () => {
    const v = filled();
    expect(await importVault(await exportVault(v, "clef"), "clef")).toStrictEqual(v);
  });

  it("ne laisse rien lire d'une photo d'ecran", async () => {
    const payload = await exportVault(filled(), "clef");
    expect(payload).not.toContain("google");
    expect(payload).not.toContain("moi@example.com");
    expect(payload.startsWith(`${TRANSFER_PREFIX}.`)).toBe(true);
  });

  it("refuse une mauvaise clef", async () => {
    const payload = await exportVault(filled(), "clef");
    await expect(importVault(payload, "mauvaise")).rejects.toThrow(/clef maitresse/i);
  });

  it("detecte une alteration", async () => {
    // AES-GCM authentifie : un octet modifie doit faire echouer, pas produire
    // un carnet corrompu.
    const [head, salt, nonce, cipher] = (await exportVault(filled(), "clef")).split(".");
    const altered = cipher.slice(0, -4) + (cipher.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
    await expect(importVault(`${head}.${salt}.${nonce}.${altered}`, "clef")).rejects.toThrow();
  });

  it("refuse une version inconnue", async () => {
    const [, salt, nonce, cipher] = (await exportVault(filled(), "clef")).split(".");
    await expect(importVault(`TC9.${salt}.${nonce}.${cipher}`, "clef")).rejects.toThrow(/inconnue/);
  });

  it("refuse un nombre de segments inattendu", async () => {
    const [, salt, nonce] = (await exportVault(filled(), "clef")).split(".");
    await expect(importVault(`TC2.${salt}.${nonce}`, "clef")).rejects.toThrow(/inattendu/);
  });

  it("refuse un sel ou un nonce de mauvaise taille avant de dechiffrer", async () => {
    const [, salt, nonce, cipher] = (await exportVault(filled(), "clef")).split(".");
    await expect(importVault(`TC2.${salt.slice(4)}.${nonce}.${cipher}`, "clef")).rejects.toThrow(
      /16 octets/,
    );
    await expect(importVault(`TC2.${salt}.${nonce.slice(4)}.${cipher}`, "clef")).rejects.toThrow(
      /16 octets/,
    );
  });

  it("ne reutilise jamais un sel ni un nonce", async () => {
    // Reutiliser un nonce avec la meme clef casse AES-GCM.
    const v = filled();
    const salts = new Set();
    const nonces = new Set();
    for (let i = 0; i < 5; i++) {
      const [, salt, nonce] = (await exportVault(v, "clef")).split(".");
      salts.add(salt);
      nonces.add(nonce);
    }
    expect(salts.size).toBe(5);
    expect(nonces.size).toBe(5);
  });

  it("garde un gros carnet scannable", async () => {
    // Un QR code plafonne a ~2,9 Ko.
    const big = emptyVault();
    for (let i = 0; i < 50; i++) {
      big.entries.push(newEntry(`site${i}.example.com`, { login: `user${i}@example.com` }));
    }
    expect((await exportVault(big, "clef")).length).toBeLessThan(2900);
  });

  it("fusionne a l'import plutot que d'ecraser", async () => {
    const local = emptyVault();
    local.entries.push(newEntry("github.com"));

    const incoming = await importVault(await exportVault(filled(), "clef"), "clef");
    const { vault, conflicts } = mergeVaults(local, incoming);

    expect(vault.entries.map((e) => e.siteKey).sort()).toStrictEqual(["github.com", "google.com"]);
    expect(conflicts).toStrictEqual([]);
  });
});

describe("interoperabilite entre implementations", () => {
  /**
   * Un carnet exporte sur un appareil doit etre lisible sur tous les autres.
   * Ce vecteur est partage : chaque implementation le dechiffre et doit
   * retrouver exactement le meme carnet. Sans lui, deux plateformes pourraient
   * diverger sur la compression ou l'encodage sans que rien ne le signale.
   *
   * Fichier synchronise depuis shared/ ; ne jamais l'editer directement.
   */
  const vector = require("./transfer-vector.json");

  it("dechiffre un payload produit par une autre implementation", async () => {
    expect(await importVault(vector.payload, vector.masterKey)).toStrictEqual(vector.vault);
  });

  it("produit un payload que les autres savent relire", async () => {
    // Aller-retour via notre propre implementation, en repartant du carnet
    // de reference : si l'encodage derivait, le contenu ne correspondrait plus.
    const reexported = await exportVault(vector.vault, vector.masterKey);
    expect(await importVault(reexported, vector.masterKey)).toStrictEqual(vector.vault);
  });

  it("derive la meme clef de transfert", async () => {
    const salt = new Uint8Array(Buffer.from(vector.payload.split(".")[1], "base64url"));
    const bits = await deriveTransferBits(vector.masterKey, salt);
    expect(Buffer.from(bits).toString("hex")).toBe(vector.derivedTransferHex);
  });

  it("couvre chaque cas refuse", () => {
    expect(vector.rejected.map((c) => c.name)).toContain("tc1");
  });

  it.each(vector.rejected.map((c) => [c.name, c]))("refuse %s", async (_name, c) => {
    await expect(importVault(c.payload, vector.masterKey)).rejects.toThrow();
  });
});

describe("decoupage en plusieurs QR", () => {
  const payload = `TC2.${"a".repeat(22)}.${"b".repeat(16)}.${"c".repeat(6000)}`;

  it("laisse un payload court en un seul code", () => {
    const small = "TC2.sel.nonce.data";
    expect(splitPayload(small)).toStrictEqual([small]);
  });

  it("coupe le corps en morceaux de 2600 caracteres", () => {
    const fragments = splitPayload(payload);
    expect(fragments).toHaveLength(3);
    expect(fragments[0].startsWith("TC2m.0.3.aaaaaaaaaaaaaaaaaaaaaa.bbbb")).toBe(true);
    expect(fragments[0].length).toBe("TC2m.0.3.".length + 2600);
    expect(fragments[2].startsWith("TC2m.2.3.")).toBe(true);
  });

  it("reassemble dans le desordre, doublons et index hors bornes ignores", () => {
    const [a, b, c] = splitPayload(payload);
    expect(joinFragments([c, a])).toBeNull();
    expect(joinFragments([c, a, a, "TC2m.7.3.zzz", b])).toBe(payload);
  });

  it("refuse les codes v1", () => {
    expect(() => joinFragments(["TC1m.0.2.abc"])).toThrow(/inconnu/);
    expect(() => joinFragments(["TC1.abc.def"])).toThrow(/inconnu/);
  });
});
