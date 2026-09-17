/**
 * Canonicalisation des hostnames, verifiee contre le referentiel partage
 * shared/canonical-site-cases.json.
 *
 * Deux implementations qui canonicalisent differemment produisent deux mots de
 * passe differents pour le meme site. Ce referentiel est croise entre les
 * plateformes, contrairement aux anciennes suites qui testaient chacune ses
 * propres cas — c'est ainsi que la divergence Android a survecu.
 *
 * Fichier synchronise depuis shared/ ; ne jamais l'editer directement.
 */
const { registrableDomain } = require("../background");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const spec = require("./canonical-site-cases.json");

const IMPL = "extension";

// La PSL est chargee par fetch() dans le service worker, ce qui echoue en
// environnement de test : on la lit donc depuis le fichier synchronise, et on
// exerce la fonction pure.
const PSL = readFileSync(join(__dirname, "..", "data", "public_suffix_list.dat"), "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("//"));

const canonical = (hostname) => registrableDomain(hostname, PSL);

describe("canonicalisation (referentiel partage)", () => {
  it("lit bien le referentiel", () => {
    expect(spec.schema).toBe(1);
    expect(spec.cases.length).toBeGreaterThan(0);
  });

  describe.each(spec.cases.map((c) => [c.id, c]))("%s", (_id, c) => {
    const divergence = c.divergences?.[IMPL];

    if (divergence === undefined) {
      it(`${c.hostname} -> ${c.expected}`, () => {
        expect(canonical(c.hostname)).toBe(c.expected);
      });
    } else {
      // Divergence connue et documentee : on verrouille le comportement REEL
      // pour qu'il ne bouge pas par accident. La corriger changerait le mot de
      // passe des utilisateurs concernes ; cela se fait au lot 1.
      it(`${c.hostname} -> ${divergence} (divergence connue, attendu ${c.expected})`, () => {
        expect(canonical(c.hostname)).toBe(divergence);
      });
    }
  });

  it("ne declare aucune divergence non listee dans le referentiel", () => {
    const unexpected = spec.cases
      .filter((c) => c.divergences?.[IMPL] === undefined)
      .filter((c) => canonical(c.hostname) !== c.expected)
      .map((c) => `${c.hostname}: attendu ${c.expected}, obtenu ${canonical(c.hostname)}`);
    expect(unexpected).toStrictEqual([]);
  });
});
