/**
 * Forme canonique d'une entree.
 *
 * Elle departage deux ecritures au meme horodatage. Deux implementations qui
 * n'ecrivent pas la meme chaine designent un gagnant different et ne
 * convergent jamais — les tests par plateforme ont deja laisse passer
 * exactement ce genre d'ecart, d'ou le fichier partage.
 *
 * Specification : shared/spec/vault-merge.md
 */
const { __canonicalJson } = require("../vault");
const fixture = require("./canonical-entries.json");

describe("forme canonique", () => {
  for (const testCase of fixture.cases) {
    it(`correspond a la fixture partagee : ${testCase.name}`, () => {
      expect(__canonicalJson(testCase.entry)).toBe(testCase.canonical);
    });
  }

  it("est compacte et triee a tous les niveaux", () => {
    const out = __canonicalJson(fixture.cases[0].entry);

    expect(out).not.toContain('": ');
    // charset trie, et non vide : JSON.stringify avec un tableau de clefs
    // vidait l'objet imbrique.
    expect(out).toContain('"charset":{"lower":true,"numbers":true,"symbols":true,"upper":true}');
  });

  it("retire un deleted faux et garde un deleted vrai", () => {
    const kept = fixture.cases.find((c) => c.name === "deleted-vrai-conserve");
    const dropped = fixture.cases.find((c) => c.name === "deleted-faux-retire");

    expect(__canonicalJson(kept.entry)).toContain('"deleted":true');
    expect(__canonicalJson(dropped.entry)).not.toContain("deleted");
  });

  it("laisse les slashs et les accents tels quels", () => {
    const out = __canonicalJson(fixture.cases.find((c) => c.name === "accents-et-slash").entry);

    expect(out).toContain("site.fr/chemin");
    expect(out).not.toContain("\\u");
    expect(out).toContain("Café");
  });
});
