/**
 * Empreinte de la clef maîtresse.
 *
 * Vérifie aussi l'interopérabilité : la même clef doit donner la même empreinte
 * partout, sinon l'utilisateur verrait deux valeurs différentes selon
 * l'appareil et cesserait de s'y fier.
 */
import { describe, it, expect } from "vitest";
import { ALPHABET, LENGTH, keyFingerprint } from "@/fingerprint";

describe("empreinte de clef", () => {
  it("est stable", async () => {
    expect((await keyFingerprint("clef")).text).toBe((await keyFingerprint("clef")).text);
  });

  it.each([
    ["clef", "clef "],
    ["clef", "Clef"],
    ["clef", "cled"],
  ])("distingue %s de %s", async (a, b) => {
    expect((await keyFingerprint(a)).text).not.toBe((await keyFingerprint(b)).text);
  });

  it("utilise un alphabet sans ambiguite", async () => {
    for (const forbidden of "01OIL") expect(ALPHABET).not.toContain(forbidden);
    expect((await keyFingerprint("clef")).text).toHaveLength(LENGTH);
  });

  it("n'affiche rien sans clef", async () => {
    expect(await keyFingerprint("")).toStrictEqual({ text: "", color: "", colorName: "" });
  });

  it("correspond aux autres implementations", async () => {
    // Vecteur produit par le CLI Python et vérifié par l'extension.
    expect((await keyFingerprint("clef")).text).toBe("KG8");
    expect((await keyFingerprint("clef")).colorName).toBe("cyan");
  });
});
