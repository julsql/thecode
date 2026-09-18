/**
 * Algorithme v2, verifie contre les vecteurs partages.
 *
 * La v2 ne remplace pas la v1 : elles coexistent, entree par entree. Les
 * vecteurs v1 restent figes et doivent continuer de passer — sans cela, les
 * mots de passe deja en service changeraient.
 */
const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;

const { deriveMasterKeyV2, generatePasswordV2 } = require("../core-v2");
const { generatePassword } = require("../background");
const vectors = require("./test-vectors.json");

const run = (c) =>
  generatePasswordV2(c.site, c.master, c.length, {
    useLower: c.charset.lower,
    useUpper: c.charset.upper,
    useSymbols: c.charset.symbols,
    useNumbers: c.charset.numbers,
    login: c.login,
    counter: c.counter,
  });

describe("conformance v2 (vecteurs partages, figes)", () => {
  it("la section v2 est figee", () => {
    expect(vectors.v2.status).toBe("frozen");
  });

  it.each(vectors.v2.cases.map((c) => [c.id, c]))("%s", async (_id, c) => {
    expect(await run(c)).toBe(c.expected);
  });
});

describe("ce que la v2 corrige", () => {
  it("supprime la collision de concatenation", async () => {
    const a = await generatePasswordV2("google.com", "abc", 20);
    const b = await generatePasswordV2("google.co", "mabc", 20);
    expect(a).not.toBe(b);

    // Et le defaut est bien reel en v1 :
    const v1a = (await generatePassword("google.com", "abc", 20, true, true, true, true)).mdp;
    const v1b = (await generatePassword("google.co", "mabc", 20, true, true, true, true)).mdp;
    expect(v1a).toBe(v1b);
  });

  it("fait entrer le login dans la derivation", async () => {
    const master = await deriveMasterKeyV2("clef");
    const perso = await generatePasswordV2("google.com", "clef", 20, { master });
    const pro = await generatePasswordV2("google.com", "clef", 20, { master, login: "pro" });
    expect(perso).not.toBe(pro);
  });

  it("permet de renouveler sans changer la clef maitresse", async () => {
    const master = await deriveMasterKeyV2("clef");
    const first = await generatePasswordV2("google.com", "clef", 20, { master });
    const second = await generatePasswordV2("google.com", "clef", 20, { master, counter: 2 });
    expect(first).not.toBe(second);
    // Revenir en arriere redonne exactement le precedent.
    expect(await generatePasswordV2("google.com", "clef", 20, { master, counter: 1 })).toBe(first);
  });
});

describe("la v1 continue de fonctionner", () => {
  // Casser la v1 changerait les mots de passe deja en service.
  it.each(vectors.v1.cases.map((c) => [c.id, c]))("%s inchange", async (_id, c) => {
    const res = await generatePassword(
      c.site,
      c.master,
      c.length,
      c.charset.lower,
      c.charset.upper,
      c.charset.symbols,
      c.charset.numbers,
    );
    expect(res.mdp).toBe(c.expected);
  });

  it("v1 et v2 different", async () => {
    const v1 = (await generatePassword("google.com", "clef", 20, true, true, true, true)).mdp;
    expect(await generatePasswordV2("google.com", "clef", 20)).not.toBe(v1);
  });
});
