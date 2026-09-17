/**
 * Conformite aux vecteurs partages (shared/test-vectors.json).
 *
 * Ce fichier n'est pas un test comme les autres : c'est le garde-fou qui
 * garantit que les 6 implementations de TheCode produisent exactement le meme
 * mot de passe. Une divergence d'un seul caractere = un utilisateur qui perd
 * l'acces a ses comptes.
 *
 * La section v1 des vecteurs est FIGEE : ces valeurs sont en production.
 * Si un test echoue ici, ce n'est jamais le vecteur qu'il faut corriger.
 *
 * Le fichier lu est une copie synchronisee depuis shared/ (cf.
 * scripts/sync-shared.sh) ; ne jamais l'editer directement.
 */
const { generatePassword, buildCharset } = require("../background");
const vectors = require("./test-vectors.json");

describe("conformance v1 (vecteurs partages, figes)", () => {
  it("lit bien les vecteurs partages", () => {
    expect(vectors.schema).toBe(1);
    expect(vectors.v1.status).toBe("frozen");
    expect(vectors.v1.cases.length).toBeGreaterThan(0);
  });

  it("utilise les memes alphabets que la specification partagee", () => {
    const { lower, upper, symbols, numbers } = vectors.v1.alphabets;
    expect(buildCharset(true, true, true, true)).toStrictEqual([lower, upper, symbols, numbers]);
  });

  describe.each(vectors.v1.cases.map((c) => [c.id, c]))("%s", (_id, c) => {
    it("reproduit le mot de passe attendu", async () => {
      const { lower, upper, symbols, numbers } = c.charset;
      const res = await generatePassword(
        c.site,
        c.master,
        c.length,
        lower,
        upper,
        symbols,
        numbers,
      );
      expect(res.mdp).toBe(c.expected);
    });

    it("annonce le meme nombre de bits", async () => {
      const { lower, upper, symbols, numbers } = c.charset;
      const res = await generatePassword(
        c.site,
        c.master,
        c.length,
        lower,
        upper,
        symbols,
        numbers,
      );
      expect(res.bits).toBe(c.bits);
    });
  });
});

describe("proprietes documentees de la v1", () => {
  it("presente la collision de concatenation (comportement v1 assume)", async () => {
    const a = vectors.v1.cases.find((c) => c.id === "collision-a");
    const b = vectors.v1.cases.find((c) => c.id === "collision-b");
    expect(a.expected).toBe(b.expected);
  });
});
