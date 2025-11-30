const { 
  generatePassword, 
  buildCharset, 
  calculateEntropyBits, 
  getSecurityLevel, 
  convertToBase, 
  applyCharsetReplacement, 
  getUniquePosition, 
  hashToBigInt 
} = require('../background');

const totalBase = [
  "portezcviuxwhskyajgblndqfm",
  "THEQUICKBROWNFXJMPSVLAZYDG",
  "@#&!)-%;<:*$+=/?>(",
  "567438921"
];

describe("generatePassword", () => {
  it("devrait générer un mot de passe avec toutes les options activées", async () => {
    const result = await generatePassword('site', 'clef', 20, true, true, true, true);
    expect(result).toMatchObject({
      security: "Très Forte",
      bits: expect.any(Number),
      color: "#1CD001"
    });

    // Vérifie la longueur
    expect(result.mdp).toHaveLength(20);
    expect(result.mdp).toBe("u8YfpdVdK*#Bpy6(9f*5");

    // Vérifie qu'au moins un caractère de chaque groupe est présent
    const groups = totalBase;
    groups.forEach(group => {
      expect(group.split("").some(c => result.mdp.includes(c))).toBe(true);
    });
  });
});

describe("buildCharset", () => {
  test.each([
    [true, true, true, true, totalBase],
    [true, false, true, false, ["portezcviuxwhskyajgblndqfm", "@#&!)-%;<:*$+=/?>("]],
    [false, false, false, false, []],
  ])("avec min=%s, maj=%s, sym=%s, chi=%s => base attendue", 
  (min, maj, sym, chi, expected) => {
    expect(buildCharset(min, maj, sym, chi)).toStrictEqual(expected);
  });
});

describe("calculateEntropyBits", () => {
  test.each([
    [totalBase, 20, 126],
    [totalBase, 10, 63],
  ])('base=%p et longueur=%i => bits=%i', (base, length, expected) => {
    expect(calculateEntropyBits(base, length)).toBe(expected);
  });
});

describe("getSecurityLevel", () => {
  test.each([
    [126, "Très Forte", "#1CD001"],
    [63, "Très Faible", "#FE0101"],
    [0, "Aucune", "#FE0101"]
  ])('%i bits => %s avec couleur %s', (bits, expectedSecurity, expectedColor) => {
    expect(getSecurityLevel(bits)).toStrictEqual({ security: expectedSecurity, color: expectedColor });
  });
});

describe("convertToBase", () => {
  test.each([
    [1, ["abc"], "b"],
    [0, ["abc"], "a"],
    [2, ["01"], "00"]
  ])('%i en base %p => %s', (x, base, expected) => {
    expect(convertToBase(x, base)).toBe(expected);
  });
});

describe("applyCharsetReplacement", () => {
  it("garantit qu'au moins un caractère de chaque groupe est présent", () => {
    const seed = 123456789n;
    const charsetGroups = ["abc", "XYZ", "123"];
    const password = "aaaaaaaaa";

    const result = applyCharsetReplacement(seed, password, charsetGroups);
    expect(result.length).toBe(password.length);
    charsetGroups.forEach(group => {
      expect(group.split("").some(c => result.includes(c))).toBe(true);
    });
  });

  it("lance une erreur si le mot de passe est trop court", () => {
    const seed = 1n;
    const charsetGroups = ["abc", "XYZ", "123"];
    const password = "ab";

    expect(() => applyCharsetReplacement(seed, password, charsetGroups))
      .toThrow(/Password must have at least/);
  });
});

describe("getUniquePosition", () => {
  it("retourne une position unique dans la longueur donnée", () => {
    const seed = 5n;
    const usedPositions = [0, 1, 2];
    const length = 5;
    const pos = getUniquePosition(seed, usedPositions, length);

    expect(pos).toBeGreaterThanOrEqual(0);
    expect(pos).toBeLessThan(length);
    expect(usedPositions.includes(pos)).toBe(false);
  });

  it("boucle si toutes les positions inférieures sont utilisées", () => {
    const seed = 3n;
    const usedPositions = [0, 1, 2, 3];
    const length = 5;

    const pos = getUniquePosition(seed, usedPositions, length);
    expect(pos).toBe(4);
  });
});

describe("hashToBigInt", () => {
  it("retourne un BigInt correct pour une chaîne donnée", async () => {
    const input = "test";
    const expectedHex =
      "9f86d081884c7d659a2feaa0c55ad015" +
      "a3bf4f1b2b0b822cd15d6c15b0f00a08";
    const expectedBigInt = BigInt("0x" + expectedHex);

    const result = await hashToBigInt(input);
    expect(typeof result).toBe("bigint");
    expect(result).toBe(expectedBigInt);
  });

  it("produit des valeurs différentes pour des entrées différentes", async () => {
    const hash1 = await hashToBigInt("hello");
    const hash2 = await hashToBigInt("world");
    expect(hash1).not.toBe(hash2);
  });
});
