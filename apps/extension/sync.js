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

async function encryptEntry(entry, key) {
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

async function decryptEntry(row, key) {
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

  const payload = {
    base_revision: pulled.result.revision,
    entries: await Promise.all(merged.entries.map((e) => encryptEntry(e, key))),
  };
  const pushed = await withFreshToken(session, (token) =>
    syncRequest(`${session.endpoint}/v1/vault`, { payload, token }),
  );

  return { vault: merged, conflicts, session: pushed.session };
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
    syncAccountPlan,
    isPaidPlan,
  };
}
