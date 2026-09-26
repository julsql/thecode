/**
 * Connexion a la synchronisation avec Google.
 *
 * Flux implicite OpenID Connect via browser.identity.launchWebAuthFlow : Google
 * renvoie un id_token dans le fragment de l'URL de redirection, que le service
 * echange ensuite contre ses propres jetons. Aucun secret client ici : le
 * client_id est public, et le nonce lie le jeton a cette demande precise.
 *
 * Safari n'a pas browser.identity : le bouton y reste cache.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

class GoogleAuthError extends Error {
  /** `code` : cancelled, unavailable, state_mismatch, no_token, google_error, flow_failed. */
  constructor(code, detail = "") {
    super(detail || code);
    this.code = code;
  }
}

/** Valeur aleatoire pour le nonce et le state (128 bits, hexadecimal). */
function randomToken(bytes = 16) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** L'API identity du navigateur, ou null quand elle manque (Safari, tests). */
function identityApi(api) {
  const identity = api?.identity;
  return identity &&
    typeof identity.launchWebAuthFlow === "function" &&
    typeof identity.getRedirectURL === "function"
    ? identity
    : null;
}

/** URL d'autorisation Google : flux implicite, id_token seul. */
function googleAuthUrl({ clientId, redirectUri, nonce, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "id_token",
    scope: "openid email",
    redirect_uri: redirectUri,
    nonce,
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

/**
 * Extrait l'id_token de l'URL de redirection.
 *
 * Le state doit etre celui envoye : sinon la reponse ne correspond pas a cette
 * demande, et on la jette.
 */
function parseGoogleRedirect(redirectUrl, expectedState) {
  let url;
  try {
    url = new URL(redirectUrl);
  } catch {
    throw new GoogleAuthError("no_token");
  }
  // Google repond dans le fragment ; certaines erreurs arrivent en query.
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const params = [...fragment.keys()].length ? fragment : url.searchParams;

  const error = params.get("error");
  if (error) {
    throw new GoogleAuthError(error === "access_denied" ? "cancelled" : "google_error", error);
  }
  if (!expectedState || params.get("state") !== expectedState) {
    throw new GoogleAuthError("state_mismatch");
  }
  const idToken = params.get("id_token");
  if (!idToken) throw new GoogleAuthError("no_token");
  return idToken;
}

/**
 * Vrai quand l'utilisateur a ferme la fenetre ou refuse.
 *
 * Chrome : « The user did not approve access. » ; Firefox : « User cancelled
 * or denied access. ».
 */
function isGoogleCancellation(error) {
  if (error?.code === "cancelled") return true;
  return /cancel|did not approve|denied|closed/i.test(error?.message || "");
}

/**
 * Ouvre la fenetre Google et rend `{ idToken, nonce }`.
 *
 * Toute erreur sort en GoogleAuthError, `cancelled` compris : l'appelant la
 * tait, et traduit les autres.
 */
async function googleSignIn({ identity, clientId, random = randomToken }) {
  if (!identity) throw new GoogleAuthError("unavailable");
  if (!clientId) throw new GoogleAuthError("unavailable");

  const nonce = random();
  const state = random();
  const url = googleAuthUrl({
    clientId,
    redirectUri: identity.getRedirectURL(),
    nonce,
    state,
  });

  let redirect;
  try {
    redirect = await identity.launchWebAuthFlow({ url, interactive: true });
  } catch (e) {
    throw new GoogleAuthError(isGoogleCancellation(e) ? "cancelled" : "flow_failed", e?.message);
  }
  if (!redirect) throw new GoogleAuthError("cancelled");

  return { idToken: parseGoogleRedirect(redirect, state), nonce };
}

if (typeof module !== "undefined") {
  module.exports = {
    GOOGLE_AUTH_URL,
    GoogleAuthError,
    randomToken,
    identityApi,
    googleAuthUrl,
    parseGoogleRedirect,
    isGoogleCancellation,
    googleSignIn,
  };
}
