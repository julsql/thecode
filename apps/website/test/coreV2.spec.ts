/**
 * Conformité de l'algorithme v2, contre les vecteurs partagés.
 *
 * Une divergence ici ne se verrait qu'à l'usage : le site rendrait un autre mot
 * de passe que le CLI pour la même entrée du carnet.
 *
 * Spécification : shared/spec/algo-v2.md
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { V2_ITERATIONS, V2_MASTER_SALT, deriveMasterKeyV2, generatePasswordV2 } from "@/coreV2";

const vectors = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "test-vectors.json"), "utf8"),
).v2.cases;

describe("algorithme v2", () => {
  it("utilise le sel et le coût de la spécification partagée", () => {
    // Un paramètre différent d'une implémentation à l'autre rendrait les mots
    // de passe mutuellement illisibles, sans que rien ne le signale.
    expect(V2_MASTER_SALT).toBe("thecode-master/v2");
    expect(V2_ITERATIONS).toBe(600000);
  });

  for (const testCase of vectors) {
    it(`reproduit le vecteur ${testCase.id}`, async () => {
      const got = await generatePasswordV2(testCase.site, testCase.master, testCase.length, {
        useLower: testCase.charset.lower,
        useUpper: testCase.charset.upper,
        useSymbols: testCase.charset.symbols,
        useNumbers: testCase.charset.numbers,
        login: testCase.login,
        counter: testCase.counter,
      });

      expect(got).toBe(testCase.expected);
    });
  }

  it("sépare les champs, la concaténation ne peut plus collisionner", async () => {
    // En v1, ("google.com", "abc") et ("google.co", "mabc") donnaient le même
    // mot de passe. C'est ce que l'octet nul corrige.
    const master = await deriveMasterKeyV2("clef");

    expect(await generatePasswordV2("google.com", "clef", 20, { login: "abc", master })).not.toBe(
      await generatePasswordV2("google.co", "clef", 20, { login: "mabc", master }),
    );
  });

  it("le compteur change le mot de passe", async () => {
    // Sans compteur, rien ne permet de renouveler un mot de passe sans changer
    // la clef maîtresse.
    const master = await deriveMasterKeyV2("clef");

    expect(await generatePasswordV2("google.com", "clef", 20, { counter: 1, master })).not.toBe(
      await generatePasswordV2("google.com", "clef", 20, { counter: 2, master }),
    );
  });

  it("une clef déjà dérivée donne le même résultat", async () => {
    const master = await deriveMasterKeyV2("clef");

    expect(await generatePasswordV2("google.com", "clef", 20, { master })).toBe(
      await generatePasswordV2("google.com", "clef", 20),
    );
  });
});
