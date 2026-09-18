/**
 * Algorithme v2.
 *
 * La v1 hache SHA-256(site + clef). Trois défauts, dont un grave : sans KDF, un
 * seul mot de passe qui fuite permet de retrouver la clef maîtresse hors ligne,
 * et cette clef ouvre tous les comptes.
 *
 * La v2 ne remplace pas la v1 : elles coexistent, entrée par entrée, via le
 * champ `v` du carnet. Une entrée existante reste en v1 et son mot de passe ne
 * change pas.
 *
 * Spécification : shared/spec/algo-v2.md
 */

import { applyCharsetReplacement, buildCharset, convertToBase } from "@/utils";

export const V2_MASTER_SALT = "thecode-master/v2";
export const V2_ITERATIONS = 600000;
export const V2_PREFIX = "thecode/v2";

/**
 * Passe la clef maîtresse dans un KDF coûteux.
 *
 * C'est la correction qui compte : SHA-256 se calcule par milliards par
 * seconde, PBKDF2 à 600 000 itérations ramène chaque essai à quelques centaines
 * de millisecondes.
 */
export async function deriveMasterKeyV2(key: string): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(V2_MASTER_SALT),
      iterations: V2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    256,
  );
  return new Uint8Array(bits);
}

/**
 * Graine de la v2.
 *
 * Les champs sont séparés par un octet nul, qu'aucun d'eux ne peut contenir :
 * en v1, la simple concaténation faisait collisionner ("google.com", "abc") et
 * ("google.co", "mabc").
 */
export async function seedV2(
  master: Uint8Array,
  site: string,
  login = "",
  counter = 1,
): Promise<bigint> {
  const encoder = new TextEncoder();
  const parts = [
    encoder.encode(V2_PREFIX),
    new Uint8Array([0]),
    encoder.encode(site),
    new Uint8Array([0]),
    encoder.encode(login),
    new Uint8Array([0]),
    encoder.encode(String(counter)),
  ];
  const message = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    message.set(part, offset);
    offset += part.length;
  }

  const hmacKey = await crypto.subtle.importKey(
    "raw",
    master,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, message));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return BigInt("0x" + hex);
}

export interface V2Options {
  useLower?: boolean;
  useUpper?: boolean;
  useSymbols?: boolean;
  useNumbers?: boolean;
  login?: string;
  counter?: number;
  /** Clef déjà dérivée : le KDF coûte cher, on ne le repaie pas par site. */
  master?: Uint8Array | null;
}

/**
 * Génère un mot de passe en v2.
 *
 * Le rendu est identique à la v1 — c'est la partie mesurée saine (124,3 bits
 * sur 126 annoncés en longueur 20). Seule la graine change.
 */
export async function generatePasswordV2(
  site: string,
  key: string,
  length: number,
  options: V2Options = {},
): Promise<string | null> {
  const {
    useLower = true,
    useUpper = true,
    useSymbols = true,
    useNumbers = true,
    login = "",
    counter = 1,
    master = null,
  } = options;

  const groups = buildCharset(useLower, useUpper, useSymbols, useNumbers);
  if (groups.length === 0 || (!site && !key)) return null;

  const seed = await seedV2(master ?? (await deriveMasterKeyV2(key)), site, login, counter);
  const raw = convertToBase(seed, groups);
  return applyCharsetReplacement(seed, raw.slice(0, length), groups);
}
