/**
 * Export et import chiffres d'un carnet.
 *
 * Le carnet ne contient aucun mot de passe. Il revele en revanche sur quels
 * sites vous avez un compte et sous quel identifiant — une photo d'ecran
 * suffit. Il est donc chiffre avant de quitter l'appareil.
 *
 * Format et choix cryptographiques : shared/spec/vault-transfer.md
 */

const TRANSFER_PREFIX = "TC2";
/** En-tete des fragments quand le payload est decoupe en plusieurs QR codes. */
const TRANSFER_MULTIPART_PREFIX = "TC2m";
const TRANSFER_FRAGMENT_SIZE = 2600;
const TRANSFER_NONCE_BYTES = 12;
const TRANSFER_SALT_BYTES = 16;
/** Prefixe du sel PBKDF2 ; le sel aleatoire du payload lui est concatene. */
const TRANSFER_KDF_LABEL = "thecode-transfer/v2";
const TRANSFER_KDF_ITERATIONS = 600000;
/** Donnees associees : un bloc chiffre pour un autre usage ne se lit pas comme un transfert. */
const TRANSFER_AAD = "thecode/transfer/v2";

function b64e(bytes) {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64d(text) {
  const padded =
    text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Decode du base64url, ou null s'il est invalide. */
function b64dOrNull(text) {
  if (typeof text !== "string" || !/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    return b64d(text);
  } catch {
    return null;
  }
}

function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * PBKDF2-HMAC-SHA256, 600 000 iterations, 32 octets.
 *
 * Chaque usage passe son propre sel, prefixe d'une etiquette versionnee : une
 * meme valeur derivee ne sert jamais a deux usages.
 */
async function pbkdf2Bits(masterKey, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(masterKey),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: TRANSFER_KDF_ITERATIONS, hash: "SHA-256" },
    material,
    256,
  );
  return new Uint8Array(bits);
}

/** Importe 32 octets en clef AES-256-GCM. */
function aesKey(raw) {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Octets de la clef de transfert : PBKDF2(clef, label || sel du payload). */
function deriveTransferBits(masterKey, salt) {
  return pbkdf2Bits(masterKey, concatBytes(new TextEncoder().encode(TRANSFER_KDF_LABEL), salt));
}

/**
 * Derive la clef d'un transfert a partir du sel aleatoire de son payload.
 *
 * Un sel propre a chaque export : un attaquant ne peut pas precalculer une
 * table valable pour tous les carnets.
 */
async function deriveTransferKey(masterKey, salt) {
  return aesKey(await deriveTransferBits(masterKey, salt));
}

/** zlib (RFC 1950), pour qu'un carnet de cinquante entrees tienne dans un QR. */
async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function exportVault(vault, masterKey) {
  const json = new TextEncoder().encode(JSON.stringify(vault));
  const salt = crypto.getRandomValues(new Uint8Array(TRANSFER_SALT_BYTES));
  const nonce = crypto.getRandomValues(new Uint8Array(TRANSFER_NONCE_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode(TRANSFER_AAD) },
    await deriveTransferKey(masterKey, salt),
    await deflate(json),
  );
  return `${TRANSFER_PREFIX}.${b64e(salt)}.${b64e(nonce)}.${b64e(cipher)}`;
}

async function importVault(payload, masterKey) {
  const parts = String(payload).trim().split(".");
  if (parts.length >= 3 && parts[0] !== TRANSFER_PREFIX) {
    // Interpreter un format inconnu au hasard serait pire que refuser.
    throw new Error(`Version « ${parts[0]} » inconnue, ce client lit ${TRANSFER_PREFIX}.`);
  }
  if (parts.length !== 4) {
    throw new Error(`Format inattendu : ${TRANSFER_PREFIX}.<sel>.<nonce>.<donnees> attendu.`);
  }

  const [, saltText, nonceText, cipherText] = parts;
  const salt = b64dOrNull(saltText);
  const nonce = b64dOrNull(nonceText);
  const cipher = b64dOrNull(cipherText);
  if (!salt || !nonce || !cipher) throw new Error("Format inattendu : base64url invalide.");
  if (salt.length !== TRANSFER_SALT_BYTES || nonce.length !== TRANSFER_NONCE_BYTES) {
    throw new Error(
      `Format inattendu : sel de ${TRANSFER_SALT_BYTES} octets et nonce de ${TRANSFER_NONCE_BYTES} attendus.`,
    );
  }

  let plain;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode(TRANSFER_AAD) },
      await deriveTransferKey(masterKey, salt),
      cipher,
    );
  } catch {
    throw new Error("Dechiffrement impossible : clef maitresse differente, ou donnees alterees.");
  }

  return JSON.parse(new TextDecoder().decode(await inflate(new Uint8Array(plain))));
}

/**
 * Decoupe un payload trop gros pour un seul QR en fragments
 * `TC2m.<index>.<total>.<morceau>`. Un payload qui tient reste un seul code.
 */
function splitPayload(payload, size = TRANSFER_FRAGMENT_SIZE) {
  const head = `${TRANSFER_PREFIX}.`;
  if (!payload.startsWith(head)) throw new Error(`Payload ${TRANSFER_PREFIX} attendu.`);
  const body = payload.slice(head.length);
  if (body.length <= size) return [payload];
  const total = Math.ceil(body.length / size);
  const fragments = [];
  for (let i = 0; i < total; i++) {
    const piece = body.slice(i * size, (i + 1) * size);
    fragments.push(`${TRANSFER_MULTIPART_PREFIX}.${i}.${total}.${piece}`);
  }
  return fragments;
}

/**
 * Reassemble des codes lus dans le desordre. Rend le payload `TC2.` complet,
 * ou null tant qu'il manque un fragment. Doublons ignores, index hors bornes
 * ecartes ; tout autre code (`TC1.`, `TC1m.`...) est refuse.
 */
function joinFragments(codes) {
  let total = 0;
  const parts = new Map();
  for (const raw of codes) {
    const code = String(raw).trim();
    if (code.startsWith(`${TRANSFER_PREFIX}.`)) return code;
    if (!code.startsWith(`${TRANSFER_MULTIPART_PREFIX}.`)) {
      throw new Error(`Code inconnu, ce client lit ${TRANSFER_PREFIX}.`);
    }
    // Le fragment contient lui-meme des « . » : ne couper que les trois premiers.
    const [, indexText = "", totalText = "", ...rest] = code.split(".");
    if (!/^\d+$/.test(indexText) || !/^\d+$/.test(totalText)) continue;
    const index = Number(indexText);
    const count = Number(totalText);
    if (count < 1 || index >= count || (total && count !== total)) continue;
    total = count;
    if (!parts.has(index)) parts.set(index, rest.join("."));
  }
  if (!total || parts.size !== total) return null;
  let body = "";
  for (let i = 0; i < total; i++) body += parts.get(i);
  return `${TRANSFER_PREFIX}.${body}`;
}

if (typeof module !== "undefined") {
  module.exports = {
    TRANSFER_PREFIX,
    TRANSFER_MULTIPART_PREFIX,
    TRANSFER_FRAGMENT_SIZE,
    TRANSFER_KDF_LABEL,
    TRANSFER_KDF_ITERATIONS,
    TRANSFER_AAD,
    b64e,
    b64d,
    b64dOrNull,
    concatBytes,
    pbkdf2Bits,
    aesKey,
    deriveTransferBits,
    deriveTransferKey,
    exportVault,
    importVault,
    splitPayload,
    joinFragments,
  };
}
