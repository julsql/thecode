/**
 * Verrou de l'ecran carnet.
 *
 * Protege l'ecran de gestion, pas les donnees : le remplissage et la
 * generation lisent le carnet sans rien demander. Voir
 * shared/spec/vault-lock.md.
 *
 * Le mot de passe n'est jamais stocke : seulement un PBKDF2-SHA256 sale, dans
 * browser.storage.local, jamais synchronise.
 */

const VAULT_LOCK_STORAGE_KEY = "vaultLock";
const VAULT_LOCK_VERSION = 1;
const VAULT_LOCK_ITERATIONS = 600000;
const VAULT_LOCK_SALT_BYTES = 16;
const VAULT_LOCK_HASH_BYTES = 32;
const VAULT_LOCK_MIN_LENGTH = 8;

function base64urlEncode(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(text) {
  const base64 = String(text).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function deriveVaultLockHash(password, salt, iterations = VAULT_LOCK_ITERATIONS) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    VAULT_LOCK_HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/**
 * Comparaison en temps constant : la duree ne depend pas de la position du
 * premier octet different.
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Refuse un mot de passe trop court. Rend un message, ou null s'il convient. */
function vaultLockPasswordError(password) {
  if (typeof password !== "string" || password.length < VAULT_LOCK_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${VAULT_LOCK_MIN_LENGTH} caractères.`;
  }
  return null;
}

/** `{ v, salt, hash }`, pret a stocker. */
async function hashVaultPassword(password, iterations = VAULT_LOCK_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(VAULT_LOCK_SALT_BYTES));
  const hash = await deriveVaultLockHash(password, salt, iterations);
  return { v: VAULT_LOCK_VERSION, salt: base64urlEncode(salt), hash: base64urlEncode(hash) };
}

async function verifyVaultPassword(password, record, iterations = VAULT_LOCK_ITERATIONS) {
  if (typeof password !== "string" || !record || record.v !== VAULT_LOCK_VERSION) return false;
  try {
    const expected = base64urlDecode(record.hash);
    const actual = await deriveVaultLockHash(password, base64urlDecode(record.salt), iterations);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function loadVaultLock(storage) {
  if (!storage) return null;
  const stored = await storage.get([VAULT_LOCK_STORAGE_KEY]);
  return stored?.[VAULT_LOCK_STORAGE_KEY] || null;
}

async function saveVaultLock(storage, record) {
  await storage.set({ [VAULT_LOCK_STORAGE_KEY]: record });
}

async function clearVaultLock(storage) {
  await storage.remove([VAULT_LOCK_STORAGE_KEY]);
}

if (typeof module !== "undefined") {
  module.exports = {
    VAULT_LOCK_STORAGE_KEY,
    VAULT_LOCK_VERSION,
    VAULT_LOCK_ITERATIONS,
    VAULT_LOCK_MIN_LENGTH,
    base64urlEncode,
    base64urlDecode,
    timingSafeEqual,
    vaultLockPasswordError,
    hashVaultPassword,
    verifyVaultPassword,
    loadVaultLock,
    saveVaultLock,
    clearVaultLock,
  };
}
