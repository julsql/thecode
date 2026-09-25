/**
 * Algorithme v2.
 *
 * La v1 hache SHA-256(site + clef). Trois defauts, dont un grave : sans KDF, un
 * seul mot de passe qui fuite permet de retrouver la clef maitresse hors ligne,
 * et cette clef ouvre tous les comptes.
 *
 * Le carnet ne contient que des entrees v2. La v1 ne subsiste qu'en
 * generation ponctuelle depuis la popup, hors carnet, pour un site dont le mot
 * de passe n'a pas encore ete change.
 *
 * Specification : shared/spec/algo-v2.md
 */

const V2_MASTER_SALT = "thecode-master/v2";
const V2_ITERATIONS = 600000;
const V2_PREFIX = "thecode/v2";

/**
 * Passe la clef maitresse dans un KDF couteux.
 *
 * C'est la correction qui compte : SHA-256 se calcule par milliards par
 * seconde, PBKDF2 a 600 000 iterations ramene chaque essai a quelques centaines
 * de millisecondes.
 */
async function deriveMasterKeyV2(key) {
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
 * Les champs sont separes par un octet nul, qu'aucun d'eux ne peut contenir :
 * en v1, la simple concatenation faisait collisionner ("google.com", "abc") et
 * ("google.co", "mabc").
 */
async function seedV2(master, site, login = "", counter = 1) {
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

/**
 * Genere un mot de passe en v2.
 *
 * `master` permet de reutiliser une clef deja derivee : le KDF coute
 * volontairement cher, on ne le repaie pas a chaque site.
 *
 * Le rendu est identique a la v1 — c'est la partie mesuree saine (124,3 bits
 * sur 126 annonces en longueur 20). Seule la graine change.
 */
async function generatePasswordV2(site, key, length, options = {}) {
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

  const seed = await seedV2(master || (await deriveMasterKeyV2(key)), site, login, counter);
  const raw = convertToBase(seed, groups);
  return applyCharsetReplacement(seed, raw.slice(0, length), groups);
}

// Dans le service worker, buildCharset/convertToBase/applyCharsetReplacement
// viennent de background.js charge par importScripts. En test, on les resout
// explicitement plutot que de compter sur une portee globale.
if (typeof module !== "undefined") {
  Object.assign(globalThis, require("./background.js"));
  module.exports = {
    V2_MASTER_SALT,
    V2_ITERATIONS,
    V2_PREFIX,
    deriveMasterKeyV2,
    seedV2,
    generatePasswordV2,
  };
}
