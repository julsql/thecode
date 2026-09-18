/**
 * Empreinte de la clef maitresse.
 *
 * Verifie aussi l'interoperabilite : la meme clef doit donner la meme empreinte
 * partout, sinon l'utilisateur verrait deux valeurs differentes selon
 * l'appareil et cesserait de s'y fier.
 */
const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;

const { FP_ALPHABET, FP_LENGTH, keyFingerprint } = require("../fingerprint");

describe("empreinte de clef", () => {
  it("est stable", async () => {
    expect((await keyFingerprint("clef")).text).toBe((await keyFingerprint("clef")).text);
  });

  it.each([
    ["clef", "clef "],
    ["clef", "Clef"],
    ["clef", "clefs"],
    ["clef", "cled"],
  ])("distingue %s de %s", async (a, b) => {
    // C'est tout l'interet : une faute de frappe doit sauter aux yeux.
    expect((await keyFingerprint(a)).text).not.toBe((await keyFingerprint(b)).text);
  });

  it("utilise un alphabet sans ambiguite", async () => {
    for (const forbidden of "01OIL") expect(FP_ALPHABET).not.toContain(forbidden);
    const { text } = await keyFingerprint("clef");
    expect(text).toHaveLength(FP_LENGTH);
    expect([...text].every((c) => FP_ALPHABET.includes(c))).toBe(true);
  });

  it("ne revele rien de la clef", async () => {
    const { text } = await keyFingerprint("ma-super-clef-secrete");
    expect(text.toLowerCase()).not.toContain("clef");
    expect(text.toLowerCase()).not.toContain("secret");
  });

  it("n'affiche rien sans clef", async () => {
    expect(await keyFingerprint("")).toStrictEqual({ text: "", color: "", colorName: "" });
  });

  it("donne aussi une couleur", async () => {
    const { color, colorName } = await keyFingerprint("clef");
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
    expect(colorName).toBeTruthy();
  });

  it("correspond a l'implementation Python", async () => {
    // Vecteur produit par apps/cli/thecode/fingerprint.py. Deux appareils qui
    // affichent des empreintes differentes pour la meme clef rendraient
    // l'indicateur inutilisable.
    expect((await keyFingerprint("clef")).text).toBe("KG8");
    expect((await keyFingerprint("clef")).colorName).toBe("cyan");
  });
});
