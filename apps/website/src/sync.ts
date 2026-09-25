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
import {
  isVaultEntryV2,
  mergeVaults,
  selectForPush,
  type Conflict,
  type Vault,
  type VaultEntry,
} from "@/vault";

export const DEFAULT_ENDPOINT = "https://thecode-api.julsql.fr";
const SESSION_KEY = "thecode.session";

export class SyncError extends Error {
  /** Statut HTTP de la réponse, 0 quand le service n'a pas répondu. */
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

export interface Session {
  endpoint: string;
  accessToken: string;
  refreshToken: string;
  /**
   * Offre du compte, telle que le service l'a dite la dernière fois.
   *
   * Gardée avec la session parce que la génération se fait hors ligne : sans
   * cette trace, l'écran ne saurait pas quoi proposer tant que le service
   * n'a pas répondu, et proposerait donc tout.
   */
  plan?: string;
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

export async function request(
  url: string,
  options: { payload?: unknown; token?: string; method?: string } = {},
) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? (options.payload ? "POST" : "GET"),
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
    throw new SyncError(`${response.status} : ${detail || response.statusText}`, response.status);
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

/** Ce que l'inscription réclame, avant de le demander. */
export interface RegistrationState {
  open: boolean;
  needsCode: boolean;
  /** Places restantes sans code, ou null quand la notion ne s'applique pas. */
  freeSlots: number | null;
  /**
   * Identifiant client Google, vide quand la connexion Google n'est pas
   * configurée. Donné par le service plutôt que recopié ici : deux copies
   * finiraient par ne plus correspondre, et le bouton échouerait sans raison
   * visible.
   */
  googleClientId?: string;
}

export async function registrationState(endpoint: string): Promise<RegistrationState> {
  return (await request(`${endpoint}/v1/auth/registration`)) as RegistrationState;
}

/**
 * Crée un compte.
 *
 * `code` couvre l'invitation, le parrainage et l'offre à vie : c'est le même
 * champ pour l'utilisateur, et le serveur sait lequel il tient.
 *
 * `lang` part avec l'inscription parce que le lien de vérification mène au
 * site, qui est traduit : recevoir un lien en anglais quand on lit le site en
 * français donne l'impression de s'être trompé d'endroit.
 */
export async function register(
  endpoint: string,
  email: string,
  password: string,
  code = "",
  lang = "en",
): Promise<Session> {
  const body = (await request(`${endpoint}/v1/auth/register`, {
    payload: {
      email,
      password,
      invite_code: code,
      lang,
      device_label: "site web",
    },
  })) as { access_token: string; refresh_token: string };

  return {
    endpoint,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
  };
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
 * Ouvre la session à partir d'un jeton Google, en créant le compte au besoin.
 *
 * Une seule route pour les deux : « continuer avec Google » ne distingue pas
 * l'inscription de la connexion, et demander lequel des deux on veut
 * reviendrait à demander de se souvenir si l'on est déjà venu.
 */
export async function googleSignIn(
  endpoint: string,
  idToken: string,
  code = "",
  lang = "en",
): Promise<Session> {
  const body = await request(`${endpoint}/v1/auth/google`, {
    payload: {
      id_token: idToken,
      invite_code: code,
      lang,
      device_label: "site web",
    },
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

/**
 * Exécute un appel authentifié et garde la session à jour.
 *
 * Le renouvellement fait tourner le jeton : oublier de réécrire la session
 * revient à se déconnecter au prochain chargement, sans rien comprendre.
 */
export async function authorized<T>(
  session: Session,
  call: (token: string) => Promise<T>,
): Promise<T> {
  const { result, session: fresh } = await withFreshToken(session, call);
  if (fresh !== session) saveSession(fresh);
  return result;
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
): Promise<{ vault: Vault; conflicts: Conflict[]; localOnly: number; session: Session }> {
  const key = await deriveTransferKey(masterKey);

  const pulled = await withFreshToken(session, (token) =>
    request(`${session.endpoint}/v1/vault`, { token }),
  );

  const remote: Vault = { schema: 1, updatedAt: vault.updatedAt, entries: [] };
  for (const row of pulled.result.entries) {
    const entry = await decryptEntry(row, key);
    // Le carnet n'accepte que la v2 : une entrée v1 venue du serveur est
    // écartée sans erreur et ne rejoint pas le carnet local.
    if (!isVaultEntryV2(entry)) continue;
    // Absent quand faux, jamais « deleted: false ». La représentation
    // canonique départage les écritures simultanées : y laisser un champ que
    // les autres implémentations n'écrivent pas ferait désigner un gagnant
    // différent selon l'appareil, et les carnets ne convergeraient jamais.
    if (entry.deleted || row.deleted) entry.deleted = true;
    else delete entry.deleted;
    remote.entries.push(entry);
  }

  const { vault: merged, conflicts } = mergeVaults(vault, remote);

  // Au-delà du plafond, le reste du carnet ne part pas : il reste propre à
  // l'appareil. Un serveur qui ne dit pas son plafond reçoit tout.
  const { push, localOnly } =
    typeof pulled.result.max_entries === "number"
      ? selectForPush(
          merged,
          pulled.result.entries.map((row: { entry_id: string }) => row.entry_id),
          pulled.result.max_entries,
        )
      : { push: merged.entries, localOnly: [] };

  const payload = {
    base_revision: pulled.result.revision,
    entries: await Promise.all(push.map((e) => encryptEntry(e, key))),
  };
  const pushed = await withFreshToken(pulled.session, (token) =>
    request(`${session.endpoint}/v1/vault`, { payload, token }),
  );

  return { vault: merged, conflicts, localOnly: localOnly.length, session: pushed.session };
}
