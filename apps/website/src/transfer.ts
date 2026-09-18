/**
 * Dérivation de la clef de transfert.
 *
 * Le sel diffère de celui des mots de passe et de celui de l'empreinte : une
 * même valeur dérivée ne doit jamais servir à deux usages, sinon une faiblesse
 * sur l'un exposerait l'autre.
 *
 * Spécification : shared/spec/vault-transfer.md
 */

export const KDF_SALT = "thecode-transfer/v1";
export const KDF_ITERATIONS = 600000;

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
