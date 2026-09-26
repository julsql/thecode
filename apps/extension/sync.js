/**
 * Client de synchronisation.
 *
 * Le carnet est chiffre AVANT de quitter le navigateur, avec une clef derivee
 * de la clef maitresse et du sel propre au compte (shared/spec/vault-sync.md).
 * Le serveur ne recoit que des blocs opaques : il ne peut lire ni les sites,
 * ni les identifiants.
 *
 * Les identifiants du compte de synchronisation sont volontairement distincts
 * de la clef maitresse. S'authentifier avec celle-ci ferait qu'une faiblesse
 * du service exposerait les mots de passe eux-memes.
 */

const SYNC_DEFAULT_ENDPOINT = "https://thecode-api.julsql.fr";
const SYNC_SESSION_KEY = "syncSession";
/** Prefixe du sel PBKDF2 de la clef de synchronisation ; le sel du compte lui est concatene. */
const SYNC_KDF_LABEL = "thecode-sync/v2";
const SYNC_KDF_SALT_BYTES = 16;
/** Donnees associees AES-GCM d'une entree, suivies de son `entry_id`. */
const SYNC_ENTRY_AAD_PREFIX = "thecode/entry/v2|";
/** Donnees associees AES-GCM des reglages par defaut. */
const SYNC_SETTINGS_AAD = "thecode/settings/v2";

class SyncError extends Error {}

/**
 * Une ligne dechiffree ne porte pas l'identifiant sous lequel elle est rangee.
 * Seule une alteration cote serveur y mene : toute la synchronisation echoue,
 * comme pour un tag GCM invalide, plutot que d'ecarter l'entree en silence
 * (shared/spec/vault-sync.md).
 */
class VaultTamperedError extends SyncError {
  constructor() {
    super(vaultTamperedMessage());
    this.code = "vault-tampered";
  }
}

function vaultTamperedMessage() {
  const i18n = (globalThis.browser || globalThis.chrome)?.i18n;
  const lang = i18n?.getUILanguage?.() || globalThis.navigator?.language || "fr";
  return lang.toLowerCase().startsWith("fr")
    ? "Le carnet reçu du serveur a été modifié : synchronisation interrompue, rien n'a été écrit."
    : "The vault received from the server was tampered with: sync stopped, nothing was written.";
}

/**
 * Session tiree d'une reponse de jeton. Le sel du compte y voyage : public,
 * il ne sert qu'a rendre la clef de synchronisation propre au compte.
 */
function sessionFromTokens(endpoint, body, previous = {}) {
  return {
    ...previous,
    endpoint,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    kdfSalt: body.kdf_salt || previous.kdfSalt || "",
  };
}

async function syncRequest(url, { payload, token, method } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method: method || (payload ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
  } catch (e) {
    throw new SyncError(`Service injoignable : ${e.message}`);
  }

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json())?.detail || "";
    } catch {
      detail = "";
    }
    throw new SyncError(`${response.status} : ${detail || response.statusText}`);
  }

  return response.status === 204 ? null : response.json();
}

async function loadSession(storage) {
  if (!storage) return null;
  try {
    const stored = await storage.get([SYNC_SESSION_KEY]);
    return stored?.[SYNC_SESSION_KEY] || null;
  } catch {
    return null;
  }
}

async function saveSession(storage, session) {
  if (!storage) return;
  try {
    await storage.set({ [SYNC_SESSION_KEY]: session });
  } catch (e) {
    console.error("TheCode: echec de l'ecriture de la session", e);
  }
}

async function clearSession(storage) {
  if (!storage) return;
  try {
    await storage.remove([SYNC_SESSION_KEY]);
  } catch (e) {
    console.error("TheCode: echec de la suppression de la session", e);
  }
}

/**
 * Revoque la session cote service : une session revoquee ne compte plus dans
 * le plafond d'appareils. Au mieux : un service injoignable ou qui refuse
 * (4xx, 5xx) ne doit pas empecher de se deconnecter, et l'on ne renouvelle
 * pas le jeton pour cet appel. Rend vrai si le service a accepte.
 */
async function syncLogout(session) {
  if (!session?.endpoint || !session?.refreshToken) return false;
  try {
    await syncRequest(`${session.endpoint}/v1/auth/logout`, {
      payload: { refresh_token: session.refreshToken },
    });
    return true;
  } catch {
    return false;
  }
}

async function syncLogin(endpoint, email, password, deviceLabel = "extension") {
  const body = await syncRequest(`${endpoint}/v1/auth/login`, {
    payload: { email, password, device_label: deviceLabel },
  });
  return sessionFromTokens(endpoint, body);
}

/** Corps de POST /v1/auth/google : le nonce lie l'id_token a cette demande. */
function googleSignInBody(idToken, nonce, lang, deviceLabel = "extension") {
  return {
    id_token: idToken,
    nonce,
    lang: String(lang || "en").slice(0, 5),
    device_label: deviceLabel,
  };
}

/** Echange un id_token Google contre une session, comme syncLogin. */
async function syncGoogleLogin(endpoint, idToken, nonce, lang, deviceLabel = "extension") {
  const body = await syncRequest(`${endpoint}/v1/auth/google`, {
    payload: googleSignInBody(idToken, nonce, lang, deviceLabel),
  });
  return sessionFromTokens(endpoint, body);
}

/**
 * Client Google (web) publie par le service, ou "" s'il n'en a pas ou ne
 * repond pas : le bouton Google reste alors cache.
 */
async function syncGoogleClientId(endpoint) {
  try {
    const body = await syncRequest(`${endpoint}/v1/auth/registration`);
    return typeof body?.googleClientId === "string" ? body.googleClientId : "";
  } catch {
    return "";
  }
}

async function syncRegister(endpoint, email, password, inviteCode = "") {
  const body = await syncRequest(`${endpoint}/v1/auth/register`, {
    payload: { email, password, invite_code: inviteCode },
  });
  return sessionFromTokens(endpoint, body);
}

/**
 * Relit l'offre du compte.
 *
 * Gardee avec la session : la generation se fait hors ligne, et l'extension
 * doit savoir quoi proposer sans attendre une reponse du service. Un echec
 * laisse l'offre connue en place plutot que de tout interdire.
 */
async function syncAccountPlan(session) {
  try {
    const { result, session: fresh } = await withFreshToken(session, (token) =>
      syncRequest(`${session.endpoint}/v1/auth/me`, { token }),
    );
    return {
      plan: result.plan,
      session: { ...fresh, kdfSalt: result.kdf_salt || fresh.kdfSalt || "" },
    };
  } catch {
    return { plan: session.plan, session };
  }
}

/** Vrai quand l'offre donne droit au compteur. */
function isPaidPlan(plan) {
  return plan === "pro";
}

/**
 * Execute un appel en renouvelant le jeton s'il a expire.
 *
 * Le jeton d'acces dure quinze minutes : sur un usage normal il expire entre
 * deux synchronisations. Redemander les identifiants a chaque fois serait
 * intenable.
 */
async function withFreshToken(session, call) {
  try {
    return { result: await call(session.accessToken), session };
  } catch (e) {
    if (!(e instanceof SyncError) || !e.message.startsWith("401")) throw e;

    const body = await syncRequest(`${session.endpoint}/v1/auth/refresh`, {
      payload: { refresh_token: session.refreshToken },
    });
    const refreshed = sessionFromTokens(session.endpoint, body, session);
    return { result: await call(refreshed.accessToken), session: refreshed };
  }
}

/**
 * Sel de derivation du compte, relu sur /v1/auth/me s'il manque a la session.
 *
 * Sans sel valide, pas de synchronisation : chiffrer avec un autre sel
 * rendrait les blocs illisibles pour les autres appareils.
 */
async function syncAccountSalt(session) {
  let salt = b64dOrNull(session.kdfSalt);
  if (!salt || salt.length !== SYNC_KDF_SALT_BYTES) {
    const me = await withFreshToken(session, (token) =>
      syncRequest(`${session.endpoint}/v1/auth/me`, { token }),
    );
    session = { ...me.session, kdfSalt: me.result?.kdf_salt || "" };
    salt = b64dOrNull(session.kdfSalt);
  }
  if (!salt || salt.length !== SYNC_KDF_SALT_BYTES) {
    throw new SyncError(
      "Le service n'a pas rendu le sel de derivation du compte : reconnectez-vous.",
    );
  }
  return { salt, session };
}

/** Octets de la clef de synchronisation : PBKDF2(clef, "thecode-sync/v2" || sel du compte). */
function deriveSyncBits(masterKey, kdfSalt) {
  return pbkdf2Bits(masterKey, concatBytes(new TextEncoder().encode(SYNC_KDF_LABEL), kdfSalt));
}

/**
 * Clef de synchronisation : propre a la clef maitresse ET au compte. Le sel du
 * compte empeche de precalculer une table valable pour tous les comptes.
 */
async function deriveSyncKey(masterKey, kdfSalt) {
  return aesKey(await deriveSyncBits(masterKey, kdfSalt));
}

/**
 * Donnees associees d'une entree : la lient a son identifiant en clair. Sans
 * elles, le serveur pourrait echanger les blobs de deux entrees sans que rien
 * ne le trahisse au dechiffrement.
 */
function entryAad(entryId) {
  return new TextEncoder().encode(SYNC_ENTRY_AAD_PREFIX + entryId);
}

/** Chiffre une valeur JSON : AES-256-GCM, `{ nonce, blob }` en base64url. */
async function sealBlob(value, key, aad) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: aad },
    key,
    plain,
  );
  return { nonce: b64e(nonce), blob: b64e(cipher) };
}

async function openBlob(sealed, key, aad) {
  let plain;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64d(sealed.nonce), additionalData: aad },
      key,
      b64d(sealed.blob),
    );
  } catch {
    throw new SyncError(
      "Dechiffrement impossible : la clef maitresse n'est pas celle qui a servi a synchroniser ce carnet, ou le bloc a ete altere.",
    );
  }
  return JSON.parse(new TextDecoder().decode(plain));
}

async function encryptEntry(entry, key) {
  return {
    entry_id: entry.id,
    ...(await sealBlob(entry, key, entryAad(entry.id))),
    deleted: Boolean(entry.deleted),
  };
}

async function decryptEntry(row, key) {
  const entry = await openBlob(row, key, entryAad(row.entry_id));
  // Les donnees associees lient deja le blob a l'identifiant ; l'entree doit
  // en plus dire la meme chose d'elle-meme, pour ne jamais etre fusionnee
  // sous un autre identifiant que le sien.
  if (!entry || typeof entry !== "object" || entry.id !== row.entry_id) {
    throw new VaultTamperedError();
  }
  return entry;
}

function sealSettings(value, key) {
  return sealBlob(value, key, new TextEncoder().encode(SYNC_SETTINGS_AAD));
}

function openSettings(sealed, key) {
  return openBlob(sealed, key, new TextEncoder().encode(SYNC_SETTINGS_AAD));
}

/**
 * Synchronise le carnet local avec le serveur.
 *
 * Toujours dans cet ordre : tirer, fusionner, pousser. Pousser sans avoir tire
 * ecraserait ce qu'un autre appareil a ecrit entre temps — et le serveur le
 * refuse, precisement pour cette raison.
 */
async function syncVault(vault, masterKey, session) {
  const account = await syncAccountSalt(session);
  session = account.session;
  const key = await deriveSyncKey(masterKey, account.salt);

  const pulled = await withFreshToken(session, (token) =>
    syncRequest(`${session.endpoint}/v1/vault`, { token }),
  );
  session = pulled.session;

  const remote = { schema: 1, updatedAt: vault.updatedAt || "", entries: [] };
  for (const row of pulled.result.entries) {
    const entry = await decryptEntry(row, key);
    // Absent quand faux, jamais « deleted: false ». La representation
    // canonique departage les ecritures simultanees : y laisser un champ que
    // les autres implementations n'ecrivent pas ferait designer un gagnant
    // different selon l'appareil, et les carnets ne convergeraient jamais.
    if (entry.deleted || row.deleted) entry.deleted = true;
    else delete entry.deleted;
    remote.entries.push(entry);
  }

  const { vault: merged, conflicts } = mergeVaults(vault, remote);

  // Au-dela du plafond, le reste du carnet ne part pas : il reste propre a
  // l'appareil. Un serveur qui ne dit pas son plafond recoit tout.
  const { push, localOnly } =
    typeof pulled.result.max_entries === "number"
      ? selectForPush(
          merged,
          pulled.result.entries.map((row) => row.entry_id),
          pulled.result.max_entries,
        )
      : { push: merged.entries, localOnly: [] };

  const payload = {
    base_revision: pulled.result.revision,
    entries: await Promise.all(push.map((e) => encryptEntry(e, key))),
  };
  const pushed = await withFreshToken(session, (token) =>
    syncRequest(`${session.endpoint}/v1/vault`, { payload, token }),
  );

  return { vault: merged, conflicts, localOnly: localOnly.length, session: pushed.session };
}

const SETTINGS_MIN_LENGTH = 4;
const SETTINGS_MAX_LENGTH = 40;

/**
 * Valide des reglages par defaut venus d'ailleurs (shared/spec/default-settings.md).
 * Rend null pour une valeur inutilisable : longueur absente, aucun jeu coche.
 */
function normalizeSettings(raw) {
  if (!raw || typeof raw !== "object" || !raw.charset || typeof raw.charset !== "object") {
    return null;
  }
  const length = Number.parseInt(raw.length, 10);
  if (Number.isNaN(length)) return null;
  const charset = {
    lower: raw.charset.lower === true,
    upper: raw.charset.upper === true,
    symbols: raw.charset.symbols === true,
    numbers: raw.charset.numbers === true,
  };
  if (!Object.values(charset).some(Boolean)) return null;
  return {
    length: Math.min(SETTINGS_MAX_LENGTH, Math.max(SETTINGS_MIN_LENGTH, length)),
    charset,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function settingsTime(updatedAt) {
  const t = Date.parse(updatedAt || "");
  return Number.isNaN(t) ? -Infinity : t;
}

/**
 * Synchronise les reglages par defaut, apres le carnet.
 *
 * Tirer, garder la valeur la plus recente (a egalite, la distante), puis
 * pousser si la locale l'etait. Un blob indechiffrable (autre clef maitresse)
 * est ignore : ni les reglages locaux ni le distant ne sont ecrases.
 * Des reglages locaux jamais modifies (sans `updatedAt`) ne sont pas pousses.
 *
 * Rend `{ settings, applied, session }` : `applied` dit s'il faut appliquer
 * `settings` localement.
 */
async function syncSettings(local, masterKey, session) {
  const account = await syncAccountSalt(session);
  session = account.session;
  const key = await deriveSyncKey(masterKey, account.salt);
  const url = `${session.endpoint}/v1/settings`;

  const pulled = await withFreshToken(session, (token) => syncRequest(url, { token }));
  session = pulled.session;

  if (pulled.result) {
    let remote;
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
    syncRequest(url, { payload, token, method: "PUT" }),
  );
  return { settings: local, applied: false, session: pushed.session };
}

if (typeof module !== "undefined") {
  Object.assign(globalThis, require("./transfer.js"), require("./vault.js"));
  module.exports = {
    SYNC_DEFAULT_ENDPOINT,
    SyncError,
    VaultTamperedError,
    loadSession,
    saveSession,
    clearSession,
    syncLogin,
    syncLogout,
    syncRegister,
    googleSignInBody,
    syncGoogleLogin,
    syncGoogleClientId,
    syncVault,
    syncSettings,
    normalizeSettings,
    syncAccountPlan,
    syncAccountSalt,
    isPaidPlan,
    deriveSyncBits,
    deriveSyncKey,
    encryptEntry,
    decryptEntry,
    sealSettings,
    openSettings,
  };
}
