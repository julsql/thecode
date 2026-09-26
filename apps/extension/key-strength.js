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

const KS_WEAK_BELOW = 10;
const KS_STRONG_FROM = 16;
const KS_STRONG_WORDS = 4;

function ksCharClass(c) {
  if (c >= "a" && c <= "z") return "lower";
  if (c >= "A" && c <= "Z") return "upper";
  if (c >= "0" && c <= "9") return "digit";
  return "other";
}

/** "none" (clef vide), "weak", "fair" ou "strong". */
function keyStrength(key) {
  const chars = [...(key || "")];
  if (chars.length === 0) return "none";
  if (chars.length < KS_WEAK_BELOW) return "weak";
  const words = key.split(/[ \t\n\r]+/).filter(Boolean).length;
  if (chars.length >= KS_STRONG_FROM || words >= KS_STRONG_WORDS) return "strong";
  return new Set(chars.map(ksCharClass)).size >= 2 ? "fair" : "weak";
}

if (typeof module !== "undefined") {
  module.exports = { keyStrength };
}
