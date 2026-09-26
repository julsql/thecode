/**
 * Client de synchronisation.
 *
 * Le carnet est chiffre AVANT de quitter le navigateur, avec la clef de
 * transfert derivee de la clef maitresse. Le serveur ne recoit que des blocs
 * opaques : il ne peut lire ni les sites, ni les identifiants.
 *
 * Les identifiants du compte de synchronisation sont volontairement distincts
 * de la clef maitresse. S'authentifier avec celle-ci ferait qu'une faiblesse
 * du service exposerait les mots de passe eux-memes.
 */

const SYNC_DEFAULT_ENDPOINT = "https://thecode-api.julsql.fr";
const SYNC_SESSION_KEY = "syncSession";

class SyncError extends Error {}

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

async function syncLogin(endpoint, email, password, deviceLabel = "extension") {
  const body = await syncRequest(`${endpoint}/v1/auth/login`, {
    payload: { email, password, device_label: deviceLabel },
  });
  return {
    endpoint,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
  };
}

async function syncRegister(endpoint, email, password, inviteCode = "") {
  const body = await syncRequest(`${endpoint}/v1/auth/register`, {
    payload: { email, password, invite_code: inviteCode },
  });
  return {
    endpoint,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
  };
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
    return { plan: result.plan, session: fresh };
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
    const refreshed = {
      endpoint: session.endpoint,
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
    };
    return { result: await call(refreshed.accessToken), session: refreshed };
  }
}

/** Chiffre une valeur JSON avec la clef de transfert : `{ nonce, blob }`. */
async function encryptBlob(value, key) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plain);
  return { nonce: b64e(nonce), blob: b64e(cipher) };
}

async function decryptBlob(row, key) {
  let plain;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64d(row.nonce) },
      key,
      b64d(row.blob),
    );
  } catch {
    throw new SyncError(
      "Dechiffrement impossible : la clef maitresse n'est pas celle qui a servi a synchroniser ce carnet.",
    );
  }
  return JSON.parse(new TextDecoder().decode(plain));
}

async function encryptEntry(entry, key) {
  return {
    entry_id: entry.id,
    ...(await encryptBlob(entry, key)),
    deleted: Boolean(entry.deleted),
  };
}

function decryptEntry(row, key) {
  return decryptBlob(row, key);
}

/**
 * Synchronise le carnet local avec le serveur.
 *
 * Toujours dans cet ordre : tirer, fusionner, pousser. Pousser sans avoir tire
 * ecraserait ce qu'un autre appareil a ecrit entre temps — et le serveur le
 * refuse, precisement pour cette raison.
 */
async function syncVault(vault, masterKey, session) {
  const key = await deriveTransferKey(masterKey);

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
  const key = await deriveTransferKey(masterKey);
  const url = `${session.endpoint}/v1/settings`;

  const pulled = await withFreshToken(session, (token) => syncRequest(url, { token }));
  session = pulled.session;

  if (pulled.result) {
    let remote;
    try {
      remote = normalizeSettings(await decryptBlob(pulled.result, key));
    } catch {
      remote = null;
    }
    if (!remote) return { settings: local, applied: false, session };
    if (settingsTime(remote.updatedAt) >= settingsTime(local.updatedAt)) {
      return { settings: remote, applied: true, session };
    }
  }

  if (!local.updatedAt) return { settings: local, applied: false, session };

  const payload = await encryptBlob(local, key);
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
    loadSession,
    saveSession,
    clearSession,
    syncLogin,
    syncRegister,
    syncVault,
    syncSettings,
    normalizeSettings,
    syncAccountPlan,
    isPaidPlan,
  };
}
