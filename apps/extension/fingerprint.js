/**
 * Empreinte de la clef maitresse.
 *
 * Une faute de frappe sur la clef ne se voit pas : elle produit simplement un
 * autre mot de passe, valide en apparence. On ne s'en apercoit qu'au refus de
 * connexion, sans savoir si le tort vient de la clef, du site ou des reglages.
 * L'empreinte rend la clef reconnaissable sans la reveler.
 *
 * Specification : shared/spec/fingerprint.md
 */

const FP_KDF_SALT = "thecode-fingerprint/v1";
const FP_KDF_ITERATIONS = 600000;

// Sans 0/O ni 1/I/L : une empreinte se lit parfois a voix haute, elle ne doit
// laisser aucune hesitation. Il reste 31 caracteres, ce qui introduit un biais
// modulo minuscule, sans importance pour un repere visuel.
const FP_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const FP_LENGTH = 3;

const FP_COLORS = [
  ["rouge", "#e5484d"],
  ["orange", "#f76b15"],
  ["ambre", "#ffb224"],
  ["citron", "#bdee63"],
  ["vert", "#46a758"],
  ["emeraude", "#29a383"],
  ["cyan", "#00a2c7"],
  ["bleu", "#0090ff"],
  ["indigo", "#3e63dd"],
  ["violet", "#6e56cf"],
  ["magenta", "#d6409f"],
  ["rose", "#e93d82"],
];

async function fingerprintBytes(masterKey) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(masterKey),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(FP_KDF_SALT),
      iterations: FP_KDF_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    256,
  );
  return new Uint8Array(bits);
}

/** Trois caracteres identifiant la clef, plus une couleur. */
async function keyFingerprint(masterKey) {
  if (!masterKey) return { text: "", color: "", colorName: "" };
  const raw = await fingerprintBytes(masterKey);
  const text = Array.from(raw.slice(0, FP_LENGTH), (b) => FP_ALPHABET[b % FP_ALPHABET.length]).join(
    "",
  );
  const [colorName, color] = FP_COLORS[raw[FP_LENGTH] % FP_COLORS.length];
  return { text, color, colorName };
}

if (typeof module !== "undefined") {
  module.exports = { FP_ALPHABET, FP_LENGTH, FP_COLORS, keyFingerprint };
}
