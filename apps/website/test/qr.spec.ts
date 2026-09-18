/**
 * Encodeur de QR code.
 *
 * Les matrices attendues sont figées dans shared/ et ont été relues par un
 * décodeur indépendant. Un seul module de différence et le code ne se scanne
 * pas — c'est le genre de panne qui ne se voit qu'avec un téléphone en main.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chooseVersion, dataCapacity, encodeQr } from "@/qr.js";

const vectors = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "qr-vectors.json"), "utf8"),
);

describe("encodeur QR", () => {
  for (const testCase of vectors.cases) {
    it(`reproduit la matrice ${testCase.name}`, () => {
      const got = encodeQr(testCase.text);

      expect(got.version).toBe(testCase.version);
      expect(got.mask).toBe(testCase.mask);
      expect(got.modules.map((row) => row.join(""))).toStrictEqual(testCase.matrix);
    });
  }

  it("choisit la plus petite version qui contient le contenu", () => {
    // Une version de trop, et le QR devient inutilement dense à scanner.
    expect(chooseVersion(1)).toBe(1);
    expect(chooseVersion(dataCapacity(1))).toBeGreaterThan(1);
  });

  it("refuse un contenu trop long plutôt que de tronquer", () => {
    // Un carnet tronqué serait pire qu'un refus : il s'importerait à moitié.
    expect(() => encodeQr("x".repeat(3000))).toThrow(/trop long/);
  });
});
