/**
 * Encodeur de QR code.
 *
 * Les matrices attendues sont figees dans shared/ et ont ete relues par un
 * decodeur independant. Un seul module de difference et le code ne se scanne
 * pas — c'est le genre de panne qui ne se voit qu'avec un telephone en main.
 */
const { encodeQr, chooseVersion, dataCapacity } = require("../qr");
const vectors = require("./qr-vectors.json");

describe("encodeur QR", () => {
  for (const testCase of vectors.cases) {
    it(`reproduit la matrice ${testCase.name}`, () => {
      const got = encodeQr(testCase.text);

      expect(got.version).toBe(testCase.version);
      expect(got.mask).toBe(testCase.mask);
      expect(got.size).toBe(testCase.size);
      expect(got.modules.map((row) => row.join(""))).toStrictEqual(testCase.matrix);
    });
  }

  it("place les trois motifs de reperage", () => {
    const { modules, size } = encodeQr("TC1.abc");

    // Sans eux, aucun lecteur ne trouve le code dans l'image.
    for (const [row, col] of [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ]) {
      expect(modules[row][col]).toBe(1);
      expect(modules[row + 1][col + 1]).toBe(0);
      expect(modules[row + 3][col + 3]).toBe(1);
    }
  });

  it("garde le module toujours noir", () => {
    // Impose par la norme, a la meme place quelle que soit la version.
    const { modules, size } = encodeQr("TC1.abc");
    expect(modules[size - 8][8]).toBe(1);
  });

  it("choisit la plus petite version qui contient le contenu", () => {
    // Une version de trop, et le QR devient inutilement dense a scanner.
    expect(chooseVersion(1)).toBe(1);
    expect(chooseVersion(dataCapacity(1) - 2)).toBe(1);
    expect(chooseVersion(dataCapacity(1))).toBeGreaterThan(1);
  });

  it("refuse un contenu trop long plutot que de tronquer", () => {
    // Un carnet tronque serait pire qu'un refus : il s'importerait a moitie.
    expect(() => encodeQr("x".repeat(3000))).toThrow(/trop long/);
  });

  it("monte jusqu'a la version 40", () => {
    const { version, size } = encodeQr("y".repeat(2900));
    expect(version).toBe(40);
    expect(size).toBe(177);
  });
});
