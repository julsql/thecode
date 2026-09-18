/**
 * Client de synchronisation.
 *
 * Le carnet est chiffré **avant** de quitter le navigateur, avec la clef de
 * transfert dérivée de la clef maîtresse. Le serveur ne reçoit que des blocs
 * opaques : il ne peut lire ni les sites, ni les identifiants.
 *
 * Les identifiants du compte sont volontairement distincts de la clef
 * maîtresse. S'authentifier avec celle-ci ferait qu'une faiblesse du service
 * exposerait les mots de passe eux-mêmes.
 */

import { deriveTransferKey } from "@/transfer";
import { mergeVaults, type Conflict, type Vault, type VaultEntry } from "@/vault";

export const DEFAULT_ENDPOINT = "https://thecode.julsql.fr/api";
const SESSION_KEY = "thecode.session";

export class SyncError extends Error {}

export interface Session {
  endpoint: string;
  accessToken: string;
  refreshToken: string;
}

function b64e(bytes: ArrayBuffer | Uint8Array): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64d(text: string): Uint8Array {
  const standard = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(standard + "=".repeat((4 - (standard.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function request(url: string, options: { payload?: unknown; token?: string } = {}) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.payload ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.payload ? JSON.stringify(options.payload) : undefined,
    });
  } catch (e) {
    throw new SyncError(`Service injoignable : ${(e as Error).message}`);
  }

  if (!response.ok) {
    let detail = "";
    try {
      detail = ((await response.json()) as { detail?: string })?.detail ?? "";
    } catch {
      detail = "";
    }
    throw new SyncError(`${response.status} : ${detail || response.statusText}`);
  }

  return response.status === 204 ? null : response.json();
}

/**
 * La session vit dans localStorage, comme le carnet : elle ne quitte pas le
 * navigateur. Une lecture qui échoue ne doit pas casser la page.
 */
export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Stockage indisponible : la synchronisation de cette session marchera,
    // mais il faudra se reconnecter au prochain chargement.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Rien à faire : la session disparaîtra avec le stockage.
  }
}

export async function login(endpoint: string, email: string, password: string): Promise<Session> {
  const body = await request(`${endpoint}/v1/auth/login`, {
    payload: { email, password, device_label: "site web" },
  });
  return {
    endpoint,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
  };
}

/**
 * Exécute un appel en renouvelant le jeton s'il a expiré.
 *
 * Le jeton d'accès dure quinze minutes : sur un usage normal il expire entre
 * deux synchronisations.
 */
async function withFreshToken<T>(
  session: Session,
  call: (token: string) => Promise<T>,
): Promise<{ result: T; session: Session }> {
  try {
    return { result: await call(session.accessToken), session };
  } catch (e) {
    if (!(e instanceof SyncError) || !e.message.startsWith("401")) throw e;

    const body = await request(`${session.endpoint}/v1/auth/refresh`, {
      payload: { refresh_token: session.refreshToken },
    });
    const refreshed: Session = {
      endpoint: session.endpoint,
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
    };
    return { result: await call(refreshed.accessToken), session: refreshed };
  }
}

async function encryptEntry(entry: VaultEntry, key: CryptoKey) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(entry));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plain);
  return {
    entry_id: entry.id,
    nonce: b64e(nonce),
    blob: b64e(cipher),
    deleted: Boolean(entry.deleted),
  };
}

async function decryptEntry(
  row: { nonce: string; blob: string; deleted: boolean },
  key: CryptoKey,
): Promise<VaultEntry> {
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64d(row.nonce) },
      key,
      b64d(row.blob),
    );
  } catch {
    throw new SyncError(
      "Déchiffrement impossible : la clef maîtresse n'est pas celle qui a servi à synchroniser ce carnet.",
    );
  }
  return JSON.parse(new TextDecoder().decode(plain)) as VaultEntry;
}

/**
 * Synchronise le carnet local avec le serveur.
 *
 * Toujours dans cet ordre : tirer, fusionner, pousser. Pousser sans avoir tiré
 * écraserait ce qu'un autre appareil a écrit entre temps — et le serveur le
 * refuse, précisément pour cette raison.
 */
export async function syncVault(
  vault: Vault,
  masterKey: string,
  session: Session,
): Promise<{ vault: Vault; conflicts: Conflict[]; session: Session }> {
  const key = await deriveTransferKey(masterKey);

  const pulled = await withFreshToken(session, (token) =>
    request(`${session.endpoint}/v1/vault`, { token }),
  );

  const remote: Vault = { schema: 1, updatedAt: vault.updatedAt, entries: [] };
  for (const row of pulled.result.entries) {
    const entry = await decryptEntry(row, key);
    // Absent quand faux, jamais « deleted: false ». La représentation
    // canonique départage les écritures simultanées : y laisser un champ que
    // les autres implémentations n'écrivent pas ferait désigner un gagnant
    // différent selon l'appareil, et les carnets ne convergeraient jamais.
    if (entry.deleted || row.deleted) entry.deleted = true;
    else delete entry.deleted;
    remote.entries.push(entry);
  }

  const { vault: merged, conflicts } = mergeVaults(vault, remote);

  const payload = {
    base_revision: pulled.result.revision,
    entries: await Promise.all(merged.entries.map((e) => encryptEntry(e, key))),
  };
  const pushed = await withFreshToken(pulled.session, (token) =>
    request(`${session.endpoint}/v1/vault`, { payload, token }),
  );

  return { vault: merged, conflicts, session: pushed.session };
}
