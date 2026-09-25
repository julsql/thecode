/**
 * Verrou de l'écran carnet.
 *
 * Protège l'écran de gestion, pas les données : la génération continue de lire
 * le carnet sans rien demander. Le site n'a pas de biométrie fiable, donc mot
 * de passe de carnet uniquement. Voir shared/spec/vault-lock.md.
 *
 * Le mot de passe n'est jamais stocké : seulement un sel et un hachage
 * PBKDF2-SHA256, local à l'appareil, jamais synchronisé.
 */

import { VAULT_STORAGE_KEY } from "@/vault";

export const LOCK_STORAGE_KEY = "thecode.vaultLock";
export const LOCK_VERSION = 1;
export const LOCK_ITERATIONS = 600_000;
export const LOCK_SALT_BYTES = 16;
export const LOCK_HASH_BYTES = 32;
export const LOCK_MIN_LENGTH = 8;

export interface LockRecord {
  v: number;
  salt: string;
  hash: string;
}

export type LockErrorCode = "too-short" | "mismatch" | "wrong-password" | "no-lock" | "storage";

export class LockError extends Error {
  readonly code: LockErrorCode;

  constructor(code: LockErrorCode) {
    super(code);
    this.code = code;
    this.name = "LockError";
  }
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Comparaison en temps constant : la durée ne dépend que de la longueur, pas
 * de la position du premier octet différent.
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function deriveLockHash(
  password: string,
  salt: Uint8Array,
  iterations = LOCK_ITERATIONS,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    LOCK_HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function isLockRecord(value: unknown): value is LockRecord {
  const r = value as LockRecord | null;
  return (
    typeof r === "object" &&
    r !== null &&
    r.v === LOCK_VERSION &&
    typeof r.salt === "string" &&
    typeof r.hash === "string"
  );
}

/** Verrou enregistré, ou null si aucun (ou stockage illisible). */
export function loadLock(): LockRecord | null {
  try {
    const raw = localStorage.getItem(LOCK_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isLockRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function hasLock(): boolean {
  return loadLock() !== null;
}

function validateNew(password: string, confirm: string): void {
  if (password.length < LOCK_MIN_LENGTH) throw new LockError("too-short");
  if (password !== confirm) throw new LockError("mismatch");
}

async function storeLock(password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(LOCK_SALT_BYTES));
  const hash = await deriveLockHash(password, salt);
  const record: LockRecord = { v: LOCK_VERSION, salt: toBase64Url(salt), hash: toBase64Url(hash) };
  try {
    localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Sans stockage, le verrou ne survivrait pas au rechargement : mieux vaut
    // le dire que laisser croire le carnet protégé.
    throw new LockError("storage");
  }
}

/** Crée le verrou à la première ouverture : saisi deux fois, 8 caractères minimum. */
export async function createLock(password: string, confirm: string): Promise<void> {
  validateNew(password, confirm);
  await storeLock(password);
}

/** Vrai si le mot de passe correspond au verrou enregistré. */
export async function verifyLock(password: string): Promise<boolean> {
  const record = loadLock();
  if (!record) return false;
  try {
    const expected = fromBase64Url(record.hash);
    const actual = await deriveLockHash(password, fromBase64Url(record.salt));
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Change le mot de passe : l'actuel est exigé. */
export async function changeLock(current: string, next: string, confirm: string): Promise<void> {
  if (!hasLock()) throw new LockError("no-lock");
  if (!(await verifyLock(current))) throw new LockError("wrong-password");
  validateNew(next, confirm);
  await storeLock(next);
}

/**
 * « Mot de passe oublié » : efface le carnet local et le verrou.
 *
 * Rien d'autre ne permet de passer le verrou. Si la synchronisation est
 * active, le carnet reviendra à la prochaine synchronisation.
 */
export function forgetLock(): void {
  try {
    localStorage.removeItem(VAULT_STORAGE_KEY);
    localStorage.removeItem(LOCK_STORAGE_KEY);
  } catch {
    // Stockage indisponible : il n'y avait rien à effacer.
  }
}
