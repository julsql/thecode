/**
 * Conformité aux vecteurs partagés (shared/test-vectors.json).
 *
 * Garde-fou garantissant que les 6 implémentations de TheCode produisent
 * exactement le même mot de passe. Une divergence d'un caractère = un
 * utilisateur qui perd l'accès à ses comptes.
 *
 * La section v1 est FIGÉE : ces valeurs sont en production. Si un test
 * échoue ici, ce n'est jamais le vecteur qu'il faut corriger.
 *
 * Le fichier lu est une copie synchronisée depuis shared/ (scripts/sync-shared.sh) ;
 * ne jamais l'éditer directement.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generatePassword, buildCharset, calculateEntropyBits } from "@/utils";

const vectors = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "test-vectors.json"), "utf8"),
);

describe("conformance v1 (vecteurs partagés, figés)", () => {
  it("lit bien les vecteurs partagés", () => {
    expect(vectors.schema).toBe(1);
    expect(vectors.v1.status).toBe("frozen");
    expect(vectors.v1.cases.length).toBeGreaterThan(0);
  });

  it("utilise les mêmes alphabets que la spécification partagée", () => {
    const { lower, upper, symbols, numbers } = vectors.v1.alphabets;
    expect(buildCharset(true, true, true, true)).toStrictEqual([lower, upper, symbols, numbers]);
  });

  it.each(vectors.v1.cases.map((c: any) => [c.id, c]))(
    "%s — reproduit le mot de passe attendu",
    async (_id: string, c: any) => {
      const { lower, upper, symbols, numbers } = c.charset;
      const got = await generatePassword(
        c.site,
        c.master,
        c.length,
        lower,
        upper,
        symbols,
        numbers,
      );
      expect(got).toBe(c.expected);
    },
  );

  it.each(vectors.v1.cases.map((c: any) => [c.id, c]))(
    "%s — annonce le même nombre de bits",
    (_id: string, c: any) => {
      const { lower, upper, symbols, numbers } = c.charset;
      // NB : signature différente de celle de l'extension
      // (extension : (groups, length) / website : (length, ...flags)).
      // Cette divergence d'API disparaîtra avec packages/core-js.
      expect(calculateEntropyBits(c.length, lower, upper, symbols, numbers)).toBe(c.bits);
    },
  );
});

describe("propriétés documentées de la v1", () => {
  it("présente la collision de concaténation (comportement v1 assumé)", () => {
    const a = vectors.v1.cases.find((c: any) => c.id === "collision-a");
    const b = vectors.v1.cases.find((c: any) => c.id === "collision-b");
    expect(a.expected).toBe(b.expected);
  });
});
