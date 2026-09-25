/**
 * Export et import chiffrés d'un carnet.
 *
 * Le carnet ne contient aucun mot de passe. Il révèle en revanche sur quels
 * sites vous avez un compte et sous quel identifiant — une photo d'écran
 * suffit. Il est donc chiffré avant de quitter l'appareil.
 *
 * Le sel diffère de celui des mots de passe et de celui de l'empreinte : une
 * même valeur dérivée ne doit jamais servir à deux usages, sinon une faiblesse
 * sur l'un exposerait l'autre.
 *
 * Spécification : shared/spec/vault-transfer.md
 */

import { keepV2Only } from "@/vault";

export const TRANSFER_PREFIX = "TC1";
export const TRANSFER_NONCE_BYTES = 12;
export const KDF_SALT = "thecode-transfer/v1";
export const KDF_ITERATIONS = 600000;

export class TransferError extends Error {}

export function b64e(bytes: ArrayBuffer | Uint8Array): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64d(text: string): Uint8Array {
  const padded =
    text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function deriveTransferKey(masterKey: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(masterKey),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(KDF_SALT),
      iterations: KDF_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Deflate brut, pour qu'un carnet de cinquante entrées tienne dans un QR. */
async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Chiffre un carnet en un payload transportable. */
export async function exportVault(vault: unknown, masterKey: string): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(vault));
  const nonce = crypto.getRandomValues(new Uint8Array(TRANSFER_NONCE_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    await deriveTransferKey(masterKey),
    await deflate(json),
  );
  return `${TRANSFER_PREFIX}.${b64e(nonce)}.${b64e(cipher)}`;
}

/** Déchiffre un payload. Lève TransferError s'il est illisible. */
export async function importVault(payload: string, masterKey: string): Promise<unknown> {
  const parts = String(payload).trim().split(".");
  // Destructure apres le controle de longueur : sans cela TypeScript tient
  // chaque element pour possiblement absent, et il a raison.
  const [version, nonce, cipher] = parts;
  if (parts.length !== 3 || !version || !nonce || !cipher) {
    throw new TransferError("Format inattendu : TC1.<nonce>.<donnees> attendu.");
  }
  if (version !== TRANSFER_PREFIX) {
    // Interpréter un format inconnu au hasard serait pire que refuser.
    throw new TransferError(`Version « ${version} » inconnue, ce client lit ${TRANSFER_PREFIX}.`);
  }

  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64d(nonce) },
      await deriveTransferKey(masterKey),
      b64d(cipher),
    );
  } catch {
    throw new TransferError(
      "Déchiffrement impossible : clef maîtresse différente, ou données altérées.",
    );
  }

  const vault: unknown = JSON.parse(new TextDecoder().decode(await inflate(new Uint8Array(plain))));
  // Le carnet n'accepte que la v2 : une entrée v1 importée est écartée.
  return vault && typeof vault === "object" ? keepV2Only(vault as { entries?: unknown }) : vault;
}
