/**
 * Export et import chiffres d'un carnet.
 *
 * Le carnet ne contient aucun mot de passe. Il revele en revanche sur quels
 * sites vous avez un compte et sous quel identifiant — une photo d'ecran
 * suffit. Il est donc chiffre avant de quitter l'appareil.
 *
 * Format et choix cryptographiques : shared/spec/vault-transfer.md
 */

const TRANSFER_PREFIX = "TC1";
const TRANSFER_NONCE_BYTES = 12;
const TRANSFER_KDF_SALT = "thecode-transfer/v1";
const TRANSFER_KDF_ITERATIONS = 600000;

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

/**
 * Derive la clef de transfert.
 *
 * Le sel differe de celui des mots de passe : sans cela la meme valeur
 * servirait a deux usages, et une faiblesse sur l'un exposerait l'autre.
 */
async function deriveTransferKey(masterKey) {
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
      salt: new TextEncoder().encode(TRANSFER_KDF_SALT),
      iterations: TRANSFER_KDF_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Deflate brut, pour qu'un carnet de cinquante entrees tienne dans un QR. */
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
  const nonce = crypto.getRandomValues(new Uint8Array(TRANSFER_NONCE_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    await deriveTransferKey(masterKey),
    await deflate(json),
  );
  return `${TRANSFER_PREFIX}.${b64e(nonce)}.${b64e(cipher)}`;
}

async function importVault(payload, masterKey) {
  const parts = String(payload).trim().split(".");
  if (parts.length !== 3) {
    throw new Error("Format inattendu : TC1.<nonce>.<donnees> attendu.");
  }

  const [version, nonce, cipher] = parts;
  if (version !== TRANSFER_PREFIX) {
    // Interpreter un format inconnu au hasard serait pire que refuser.
    throw new Error(`Version « ${version} » inconnue, ce client lit ${TRANSFER_PREFIX}.`);
  }

  let plain;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64d(nonce) },
      await deriveTransferKey(masterKey),
      b64d(cipher),
    );
  } catch {
    throw new Error("Dechiffrement impossible : clef maitresse differente, ou donnees alterees.");
  }

  const vault = JSON.parse(new TextDecoder().decode(await inflate(new Uint8Array(plain))));
  // Un `v` residuel est ignore, jamais reecrit : une entree derive toujours en v2.
  return stripVersions(vault);
}

if (typeof module !== "undefined") {
  // Dans le service worker, stripVersions vient de vault.js, charge avant.
  Object.assign(globalThis, { stripVersions: require("./vault.js").stripVersions });
  module.exports = {
    TRANSFER_PREFIX,
    TRANSFER_KDF_SALT,
    TRANSFER_KDF_ITERATIONS,
    b64e,
    b64d,
    deriveTransferKey,
    exportVault,
    importVault,
  };
}
