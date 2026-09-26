/**
 * Robustesse de la clef maitresse.
 *
 * Toute la securite du carnet synchronise repose sur cette clef : un attaquant
 * qui obtient la base peut essayer hors ligne les clefs courantes. Ce calcul ne
 * sert qu'a guider, il ne bloque jamais la definition de la clef. Purement
 * local : ni reseau, ni journal, ni stockage.
 *
 * Specification : shared/spec/key-strength.md
 */

export type KeyStrength = "none" | "weak" | "fair" | "strong";

export const KEY_WEAK_BELOW = 10;
export const KEY_STRONG_FROM = 16;
export const KEY_STRONG_WORDS = 4;

function charClass(c: string): string {
  if (c >= "a" && c <= "z") return "lower";
  if (c >= "A" && c <= "Z") return "upper";
  if (c >= "0" && c <= "9") return "digit";
  return "other";
}

export function keyStrength(key: string): KeyStrength {
  // Points de code, pas unites UTF-16 : un emoji compte pour un caractere.
  const chars = [...key];
  if (chars.length === 0) return "none";
  if (chars.length < KEY_WEAK_BELOW) return "weak";
  const words = key.split(/[ \t\n\r]+/).filter(Boolean).length;
  if (chars.length >= KEY_STRONG_FROM || words >= KEY_STRONG_WORDS) return "strong";
  return new Set(chars.map(charClass)).size >= 2 ? "fair" : "weak";
}
