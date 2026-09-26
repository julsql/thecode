/**
 * Client de synchronisation.
 *
 * Le carnet est chiffré **avant** de quitter le navigateur, avec une clef
 * dérivée de la clef maîtresse et du sel propre au compte
 * (shared/spec/vault-sync.md). Le serveur ne reçoit que des blocs opaques : il
 * ne peut lire ni les sites, ni les identifiants.
 *
 * Les identifiants du compte sont volontairement distincts de la clef
 * maîtresse. S'authentifier avec celle-ci ferait qu'une faiblesse du service
 * exposerait les mots de passe eux-mêmes.
 */

import { normalizeSettings, type DefaultSettings } from "@/settings";
import { aesKey, b64d, b64dOrNull, b64e, concatBytes, pbkdf2Bits } from "@/transfer";
import { mergeVaults, selectForPush, type Conflict, type Vault, type VaultEntry } from "@/vault";

export const DEFAULT_ENDPOINT = "https://thecode-api.julsql.fr";
const SESSION_KEY = "thecode.session";
/** Préfixe du sel PBKDF2 de la clef de synchronisation ; le sel du compte lui est concaténé. */
export const SYNC_KDF_LABEL = "thecode-sync/v2";
export const KDF_SALT_BYTES = 16;
/** Données associées AES-GCM d'une entrée, suivies de son `entry_id`. */
export const ENTRY_AAD_PREFIX = "thecode/entry/v2|";
/** Données associées AES-GCM des réglages par défaut. */
export const SETTINGS_AAD = "thecode/settings/v2";

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
  /**
   * Sel de dérivation du compte, en base64url, tel que le service l'a rendu.
   * Public : il ne sert qu'à rendre la clef de synchronisation propre au
   * compte, et le serveur le connaît de toute façon.
   */
  kdfSalt?: string;
}

/** Ce que rend toute route qui ouvre ou renouvelle une session. */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  kdf_salt?: string;
}

/**
 * Session tirée d'une réponse de jeton. Le sel du compte y voyage ; à défaut,
 * celui de la session précédente est gardé.
 */
export function sessionFromTokens(
  endpoint: string,
  body: TokenResponse,
  previous?: Session,
): Session {
  return {
    ...previous,
    endpoint,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    kdfSalt: body.kdf_salt || previous?.kdfSalt || "",
  };
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

/**
 * Révoque la session côté service : une session révoquée ne compte plus dans
 * le plafond d'appareils. Au mieux : un service injoignable ou qui refuse
 * (4xx, 5xx) ne doit pas empêcher de se déconnecter, et l'on ne renouvelle
 * pas le jeton pour cet appel. Rend vrai si le service a accepté.
 */
export async function logout(session: Session): Promise<boolean> {
  try {
    await request(`${session.endpoint}/v1/auth/logout`, {
      payload: { refresh_token: session.refreshToken },
    });
    return true;
  } catch {
    return false;
  }
}

/** Se déconnecter : révoquer la session au mieux, puis l'oublier quoi qu'il arrive. */
export async function signOutSession(): Promise<void> {
  const session = loadSession();
  try {
    if (session) await logout(session);
  } finally {
    clearSession();
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
  /** Vrai quand la connexion Apple est configurée côté service. */
  appleEnabled?: boolean;
  /** Services ID d'Apple pour le site, vide quand Apple n'est pas configuré. */
  appleWebClientId?: string;
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
      client: "web",
    },
  })) as TokenResponse;

  return sessionFromTokens(endpoint, body);
}

/**
 * Ouvre une session du site.
 *
 * `client: "web"` (comme à l'inscription et avec Google) : le site est
 * l'endroit où l'on déconnecte un appareil, ses sessions ne comptent donc pas
 * dans le plafond d'appareils et ne sont jamais refusées à cause de lui.
 */
export async function login(endpoint: string, email: string, password: string): Promise<Session> {
  const body = await request(`${endpoint}/v1/auth/login`, {
    payload: { email, password, device_label: "site web", client: "web" },
  });
  return sessionFromTokens(endpoint, body);
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
      client: "web",
    },
  });
  return sessionFromTokens(endpoint, body);
}

/**
 * Ouvre la session à partir d'un jeton Apple, en créant le compte au besoin.
 *
 * `nonce` est le nonce **brut** : Apple a reçu son empreinte SHA-256, et le
 * service la recalcule pour la comparer à celle du jeton.
 */
export async function appleSignIn(
  endpoint: string,
  identityToken: string,
  nonce: string,
  code = "",
  lang = "en",
  authorizationCode = "",
): Promise<Session> {
  const body = await request(`${endpoint}/v1/auth/apple`, {
    payload: {
      identity_token: identityToken,
      nonce,
      invite_code: code,
      lang,
      device_label: "site web",
      client: "web",
      // Facultatif : sert au service à révoquer les jetons Apple quand le
      // compte est supprimé.
      ...(authorizationCode ? { authorization_code: authorizationCode } : {}),
    },
  });
  return sessionFromTokens(endpoint, body);
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
    const refreshed = sessionFromTokens(session.endpoint, body, session);
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

/**
 * Sel de dérivation du compte, relu sur /v1/auth/me s'il manque à la session.
 *
 * Sans sel valide, pas de synchronisation : chiffrer avec un autre sel
 * rendrait les blocs illisibles pour les autres appareils.
 */
export async function accountSalt(
  session: Session,
): Promise<{ salt: Uint8Array<ArrayBuffer>; session: Session }> {
  let salt = b64dOrNull(session.kdfSalt);
  if (!salt || salt.length !== KDF_SALT_BYTES) {
    const me = await withFreshToken(session, (token) =>
      request(`${session.endpoint}/v1/auth/me`, { token }),
    );
    session = { ...me.session, kdfSalt: me.result?.kdf_salt || "" };
    salt = b64dOrNull(session.kdfSalt);
  }
  if (!salt || salt.length !== KDF_SALT_BYTES) {
    throw new SyncError(
      "Le service n'a pas rendu le sel de dérivation du compte : reconnectez-vous.",
    );
  }
  return { salt, session };
}

/** Octets de la clef de synchronisation : PBKDF2(clef, "thecode-sync/v2" || sel du compte). */
export function deriveSyncBits(
  masterKey: string,
  kdfSalt: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  return pbkdf2Bits(masterKey, concatBytes(new TextEncoder().encode(SYNC_KDF_LABEL), kdfSalt));
}

/**
 * Clef de synchronisation : propre à la clef maîtresse **et** au compte. Le
 * sel du compte empêche de précalculer une table valable pour tous les comptes.
 */
export async function deriveSyncKey(masterKey: string, kdfSalt: Uint8Array): Promise<CryptoKey> {
  return aesKey(await deriveSyncBits(masterKey, kdfSalt));
}

/**
 * Données associées d'une entrée : la lient à son identifiant en clair. Sans
 * elles, le serveur pourrait échanger les blobs de deux entrées sans que rien
 * ne le trahisse au déchiffrement.
 */
function entryAad(entryId: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(ENTRY_AAD_PREFIX + entryId);
}

interface Sealed {
  nonce: string;
  blob: string;
}

/** Chiffre une valeur JSON : AES-256-GCM, `{ nonce, blob }` en base64url. */
async function seal(value: unknown, key: CryptoKey, aad: Uint8Array<ArrayBuffer>): Promise<Sealed> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: aad },
    key,
    plain,
  );
  return { nonce: b64e(nonce), blob: b64e(cipher) };
}

async function open(
  sealed: Sealed,
  key: CryptoKey,
  aad: Uint8Array<ArrayBuffer>,
): Promise<unknown> {
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64d(sealed.nonce), additionalData: aad },
      key,
      b64d(sealed.blob),
    );
  } catch {
    throw new SyncError(
      "Déchiffrement impossible : la clef maîtresse n'est pas celle qui a servi à synchroniser ce carnet, ou le bloc a été altéré.",
    );
  }
  return JSON.parse(new TextDecoder().decode(plain));
}

export async function encryptEntry(entry: VaultEntry, key: CryptoKey) {
  return {
    entry_id: entry.id,
    ...(await seal(entry, key, entryAad(entry.id))),
    deleted: Boolean(entry.deleted),
  };
}

export async function decryptEntry(
  row: { entry_id: string; nonce: string; blob: string },
  key: CryptoKey,
): Promise<VaultEntry> {
  const entry = await open(row, key, entryAad(row.entry_id));
  // Les données associées lient déjà le blob à l'identifiant ; l'entrée doit
  // en plus dire la même chose d'elle-même, pour ne jamais être fusionnée
  // sous un autre identifiant que le sien.
  if (!entry || typeof entry !== "object" || (entry as VaultEntry).id !== row.entry_id) {
    throw new SyncError("Entrée incohérente : son identifiant ne correspond pas à la ligne.");
  }
  return entry as VaultEntry;
}

export function sealSettings(value: unknown, key: CryptoKey): Promise<Sealed> {
  return seal(value, key, new TextEncoder().encode(SETTINGS_AAD));
}

export function openSettings(sealed: Sealed, key: CryptoKey): Promise<unknown> {
  return open(sealed, key, new TextEncoder().encode(SETTINGS_AAD));
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
  const account = await accountSalt(session);
  const key = await deriveSyncKey(masterKey, account.salt);

  const pulled = await withFreshToken(account.session, (token) =>
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

function settingsTime(updatedAt: string): number {
  const t = Date.parse(updatedAt);
  return Number.isNaN(t) ? -Infinity : t;
}

/**
 * Synchronise les réglages par défaut, après le carnet.
 *
 * Tirer, garder la valeur la plus récente (à égalité, la distante), puis
 * pousser si la locale l'était. Un blob indéchiffrable (autre clef maîtresse)
 * est ignoré : ni les réglages locaux ni le distant ne sont écrasés. Des
 * réglages jamais modifiés (sans `updatedAt`) ne sont pas poussés.
 * Voir shared/spec/default-settings.md.
 *
 * `applied` dit s'il faut appliquer `settings` localement.
 */
export async function syncSettings(
  local: DefaultSettings,
  masterKey: string,
  session: Session,
): Promise<{ settings: DefaultSettings; applied: boolean; session: Session }> {
  const account = await accountSalt(session);
  const key = await deriveSyncKey(masterKey, account.salt);
  const url = `${session.endpoint}/v1/settings`;

  const pulled = await withFreshToken(account.session, (token) => request(url, { token }));
  session = pulled.session;

  if (pulled.result) {
    let remote: DefaultSettings | null;
    try {
      remote = normalizeSettings(await openSettings(pulled.result, key));
    } catch {
      remote = null;
    }
    if (!remote) return { settings: local, applied: false, session };
    if (settingsTime(remote.updatedAt) >= settingsTime(local.updatedAt)) {
      return { settings: remote, applied: true, session };
    }
  }

  if (!local.updatedAt) return { settings: local, applied: false, session };

  const payload = await sealSettings(local, key);
  const pushed = await withFreshToken(session, (token) =>
    request(url, { payload, token, method: "PUT" }),
  );
  return { settings: local, applied: false, session: pushed.session };
}
