/**
 * Empreinte de la clef maîtresse.
 *
 * Une faute de frappe sur la clef ne se voit pas : elle produit simplement un
 * autre mot de passe, valide en apparence. L'empreinte rend la clef
 * reconnaissable sans la révéler.
 *
 * Spécification : shared/spec/fingerprint.md
 */

const KDF_SALT = "thecode-fingerprint/v1";
const KDF_ITERATIONS = 600000;

// Sans 0/O ni 1/I/L : une empreinte se lit parfois à voix haute, elle ne doit
// laisser aucune hésitation.
export const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const LENGTH = 3;

export const COLORS: Array<[string, string]> = [
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

export interface Fingerprint {
  text: string;
  color: string;
  colorName: string;
}

export async function keyFingerprint(masterKey: string): Promise<Fingerprint> {
  if (!masterKey) return { text: "", color: "", colorName: "" };

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
      salt: new TextEncoder().encode(KDF_SALT),
      iterations: KDF_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    256,
  );

  const raw = new Uint8Array(bits);
  const text = Array.from(raw.slice(0, LENGTH), (b) => ALPHABET[b % ALPHABET.length] ?? "").join(
    "",
  );
  // COLORS n'est jamais vide et l'index est borne par le modulo : le repli
  // n'existe que pour satisfaire noUncheckedIndexedAccess.
  const [colorName, color] = COLORS[(raw[LENGTH] ?? 0) % COLORS.length] ?? ["", ""];
  return { text, color, colorName };
}
