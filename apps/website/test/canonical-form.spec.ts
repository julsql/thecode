/**
 * Forme canonique d'une entrée.
 *
 * Elle départage deux écritures au même horodatage. Deux implémentations qui
 * n'écrivent pas la même chaîne désignent un gagnant différent et ne
 * convergent jamais — les tests par plateforme ont déjà laissé passer
 * exactement ce genre d'écart, d'où le fichier partagé.
 *
 * Spécification : shared/spec/vault-merge.md
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "@/vault";

const fixture = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "canonical-entries.json"), "utf8"),
);

describe("forme canonique", () => {
  for (const testCase of fixture.cases) {
    it(`correspond à la fixture partagée : ${testCase.name}`, () => {
      expect(canonicalJson(testCase.entry)).toBe(testCase.canonical);
    });
  }

  it("est compacte et triée à tous les niveaux", () => {
    const out = canonicalJson(fixture.cases[0].entry);

    expect(out).not.toContain('": ');
    // charset trié, et non vidé : JSON.stringify avec un tableau de clefs
    // vidait l'objet imbriqué.
    expect(out).toContain('"charset":{"lower":true,"numbers":true,"symbols":true,"upper":true}');
  });

  it("retire un deleted faux et garde un deleted vrai", () => {
    const kept = fixture.cases.find((c) => c.name === "deleted-vrai-conserve");
    const dropped = fixture.cases.find((c) => c.name === "deleted-faux-retire");

    expect(canonicalJson(kept.entry)).toContain('"deleted":true');
    expect(canonicalJson(dropped.entry)).not.toContain("deleted");
  });

  it("laisse les slashs et les accents tels quels", () => {
    const out = canonicalJson(fixture.cases.find((c) => c.name === "accents-et-slash").entry);

    expect(out).toContain("site.fr/chemin");
    expect(out).not.toContain("\\u");
    expect(out).toContain("Café");
  });
});
