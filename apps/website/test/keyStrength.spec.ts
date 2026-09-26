/**
 * Robustesse de la clef maitresse : memes seuils sur toutes les plateformes
 * (shared/spec/key-strength.md).
 */
import { describe, it, expect } from "vitest";
import { keyStrength } from "@/keyStrength";

describe("robustesse de la clef", () => {
  it.each([
    ["", "none"],
    ["soleil", "weak"],
    ["Abc 12!", "weak"],
    ["soleilrouge", "weak"],
    ["SOLEILROUGE", "weak"],
    ["Soleil rouge", "fair"],
    ["soleilrouge7", "fair"],
    ["un chat va ici", "strong"],
    ["unephrasesansespace", "strong"],
  ])("%j est %s", (key, expected) => {
    expect(keyStrength(key)).toBe(expected);
  });

  it("compte les points de code, pas les unites UTF-16", () => {
    expect(keyStrength("🌙".repeat(9))).toBe("weak");
    expect(keyStrength("é".repeat(10))).toBe("weak");
    expect(keyStrength("é".repeat(9) + "a")).toBe("fair");
  });

  it("respecte exactement les seuils", () => {
    expect(keyStrength("a".repeat(9))).toBe("weak");
    expect(keyStrength("a".repeat(15))).toBe("weak");
    expect(keyStrength("a".repeat(16))).toBe("strong");
    expect(keyStrength("ab cd ef gh")).toBe("strong");
    expect(keyStrength("abc def ghi")).toBe("fair");
    expect(keyStrength("ab\tcd\nef\rgh")).toBe("strong");
  });
});
