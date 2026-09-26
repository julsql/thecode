/**
 * Export et import chiffrés d'un carnet.
 *
 * Le carnet ne contient aucun mot de passe. Il révèle en revanche sur quels
 * sites vous avez un compte et sous quel identifiant — une photo d'écran
 * suffit. Il est donc chiffré avant de quitter l'appareil.
 *
 * Chaque dérivation passe son propre sel, préfixé d'une étiquette versionnée :
 * une même valeur dérivée ne doit jamais servir à deux usages, sinon une
 * faiblesse sur l'un exposerait l'autre.
 *
 * Spécification : shared/spec/vault-transfer.md
 */

export const TRANSFER_PREFIX = "TC2";
/** En-tête des fragments quand le payload est découpé en plusieurs QR codes. */
export const MULTIPART_PREFIX = "TC2m";
export const FRAGMENT_SIZE = 2600;
export const TRANSFER_NONCE_BYTES = 12;
export const TRANSFER_SALT_BYTES = 16;
/** Préfixe du sel PBKDF2 ; le sel aléatoire du payload lui est concaténé. */
export const KDF_LABEL = "thecode-transfer/v2";
export const KDF_ITERATIONS = 600000;
/** Données associées : un bloc chiffré pour un autre usage ne se lit pas comme un transfert. */
export const TRANSFER_AAD = "thecode/transfer/v2";

export class TransferError extends Error {}

export function b64e(bytes: ArrayBuffer | Uint8Array): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64d(text: string): Uint8Array<ArrayBuffer> {
  const padded =
    text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Décode du base64url, ou null s'il est invalide. */
export function b64dOrNull(text: unknown): Uint8Array<ArrayBuffer> | null {
  if (typeof text !== "string" || !/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    return b64d(text);
  } catch {
    return null;
  }
}

export function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** PBKDF2-HMAC-SHA256, 600 000 itérations, 32 octets. */
export async function pbkdf2Bits(
  masterKey: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(masterKey),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: KDF_ITERATIONS, hash: "SHA-256" },
    material,
    256,
  );
  return new Uint8Array(bits);
}

/** Importe 32 octets en clef AES-256-GCM. */
export function aesKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Octets de la clef de transfert : PBKDF2(clef, "thecode-transfer/v2" || sel du payload). */
export function deriveTransferBits(
  masterKey: string,
  salt: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  return pbkdf2Bits(masterKey, concatBytes(new TextEncoder().encode(KDF_LABEL), salt));
}

/**
 * Dérive la clef d'un transfert à partir du sel aléatoire de son payload : un
 * attaquant ne peut pas précalculer une table valable pour tous les carnets.
 */
export async function deriveTransferKey(masterKey: string, salt: Uint8Array): Promise<CryptoKey> {
  return aesKey(await deriveTransferBits(masterKey, salt));
}

/** zlib (RFC 1950), pour qu'un carnet de cinquante entrées tienne dans un QR. */
async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Chiffre un carnet en un payload transportable. */
export async function exportVault(vault: unknown, masterKey: string): Promise<string> {
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

/** Déchiffre un payload. Lève TransferError s'il est illisible. */
export async function importVault(payload: string, masterKey: string): Promise<unknown> {
  const parts = String(payload).trim().split(".");
  if (parts.length >= 3 && parts[0] !== TRANSFER_PREFIX) {
    // Interpréter un format inconnu au hasard serait pire que refuser.
    throw new TransferError(`Version « ${parts[0]} » inconnue, ce client lit ${TRANSFER_PREFIX}.`);
  }
  if (parts.length !== 4) {
    throw new TransferError(
      `Format inattendu : ${TRANSFER_PREFIX}.<sel>.<nonce>.<donnees> attendu.`,
    );
  }

  const salt = b64dOrNull(parts[1]);
  const nonce = b64dOrNull(parts[2]);
  const cipher = b64dOrNull(parts[3]);
  if (!salt || !nonce || !cipher) throw new TransferError("Format inattendu : base64url invalide.");
  if (salt.length !== TRANSFER_SALT_BYTES || nonce.length !== TRANSFER_NONCE_BYTES) {
    throw new TransferError(
      `Format inattendu : sel de ${TRANSFER_SALT_BYTES} octets et nonce de ${TRANSFER_NONCE_BYTES} attendus.`,
    );
  }

  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode(TRANSFER_AAD) },
      await deriveTransferKey(masterKey, salt),
      cipher,
    );
  } catch {
    throw new TransferError(
      "Déchiffrement impossible : clef maîtresse différente, ou données altérées.",
    );
  }

  return JSON.parse(new TextDecoder().decode(await inflate(new Uint8Array(plain))));
}

/**
 * Découpe un payload trop gros pour un seul QR en fragments
 * `TC2m.<index>.<total>.<morceau>`. Un payload qui tient reste un seul code.
 */
export function splitPayload(payload: string, size = FRAGMENT_SIZE): string[] {
  const head = `${TRANSFER_PREFIX}.`;
  if (!payload.startsWith(head)) throw new TransferError(`Payload ${TRANSFER_PREFIX} attendu.`);
  const body = payload.slice(head.length);
  if (body.length <= size) return [payload];
  const total = Math.ceil(body.length / size);
  const fragments: string[] = [];
  for (let i = 0; i < total; i++) {
    fragments.push(`${MULTIPART_PREFIX}.${i}.${total}.${body.slice(i * size, (i + 1) * size)}`);
  }
  return fragments;
}

/**
 * Réassemble des codes lus dans le désordre. Rend le payload `TC2.` complet,
 * ou null tant qu'il manque un fragment. Doublons ignorés, index hors bornes
 * écartés ; tout autre code (`TC1.`, `TC1m.`…) est refusé.
 */
export function joinFragments(codes: Iterable<string>): string | null {
  let total = 0;
  const parts = new Map<number, string>();
  for (const raw of codes) {
    const code = String(raw).trim();
    if (code.startsWith(`${TRANSFER_PREFIX}.`)) return code;
    if (!code.startsWith(`${MULTIPART_PREFIX}.`)) {
      throw new TransferError(`Code inconnu, ce client lit ${TRANSFER_PREFIX}.`);
    }
    // Le fragment contient lui-même des « . » : ne couper que les trois premiers.
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
