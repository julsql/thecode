/**
 * Bouton « Se connecter avec Apple ».
 *
 * Même règle que pour Google : le script d'Apple est chargé à la demande,
 * seulement sur la page du compte et seulement si le service annonce la
 * connexion Apple. Tout échec de chargement est silencieux et rend `null` :
 * la page continue avec l'adresse et le mot de passe.
 *
 * Le flux passe par une fenêtre surgissante (`usePopup`). Apple exige tout de
 * même une adresse de retour : `window.location.origin + "/"`, qui doit être
 * déclarée comme « Return URL » du Services ID, avec le domaine du site.
 *
 * Le nonce part haché (SHA-256, hexadécimal) chez Apple, qui le recopie dans
 * le jeton ; le service reçoit le nonce brut et refait le hachage. Un jeton
 * volé ne sert donc à rien sans le nonce qui l'a demandé.
 */

const SCRIPT_BASE = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1";

/** Les erreurs d'Apple qui veulent dire « l'utilisateur a renoncé ». */
const CANCELLED = new Set(["popup_closed_by_user", "user_cancelled_authorize"]);

interface AppleInitOptions {
  clientId: string;
  scope: string;
  redirectURI: string;
  usePopup: boolean;
  nonce: string;
  state: string;
}

interface AppleSignInResponse {
  authorization?: { id_token?: string; state?: string; code?: string };
}

interface AppleIdApi {
  auth: {
    init(options: AppleInitOptions): void;
    signIn(): Promise<AppleSignInResponse>;
  };
}

declare global {
  interface Window {
    AppleID?: AppleIdApi;
  }
}

/** Ce qu'il faut envoyer au service : le jeton et le nonce brut. */
export interface AppleCredential {
  idToken: string;
  rawNonce: string;
}

export interface AppleSignIn {
  /** `null` quand l'utilisateur ferme la fenêtre : rien à dire dans ce cas. */
  signIn(): Promise<AppleCredential | null>;
}

/** Réponse d'Apple qui ne correspond pas à la demande : on ne l'envoie pas. */
export class AppleSignInError extends Error {}

/** Langue du script d'Apple, qui traduit sa fenêtre. */
export function appleScriptUrl(lang: string): string {
  const locale = lang === "fr" ? "fr_FR" : "en_US";
  return `${SCRIPT_BASE}/${locale}/appleid.auth.js`;
}

let loading: Promise<boolean> | null = null;

function loadScript(lang: string): Promise<boolean> {
  if (loading) return loading;

  loading = new Promise<boolean>((resolve) => {
    if (typeof document === "undefined") {
      resolve(false);
      return;
    }
    if (window.AppleID?.auth) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = appleScriptUrl(lang);
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(Boolean(window.AppleID?.auth));
    // Bloqueur, réseau coupé, Apple indisponible : pas de bouton, et on
    // pourra réessayer au prochain affichage de la page.
    script.onerror = () => {
      loading = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return loading;
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Charge le script et prépare une première demande.
 *
 * Le nonce et l'état sont prêts avant le clic : les calculer au clic ferait
 * passer une attente entre le geste et l'ouverture de la fenêtre, et Safari
 * bloque alors la fenêtre surgissante.
 */
export async function setupAppleSignIn(clientId: string, lang = "en"): Promise<AppleSignIn | null> {
  if (!clientId) return null;
  if (!(await loadScript(lang))) return null;

  const api = window.AppleID?.auth;
  if (!api) return null;

  async function prepare() {
    const rawNonce = randomHex(32);
    const state = randomHex(16);
    api!.init({
      clientId,
      scope: "email",
      redirectURI: `${window.location.origin}/`,
      usePopup: true,
      nonce: await sha256Hex(rawNonce),
      state,
    });
    return { rawNonce, state };
  }

  let pending: ReturnType<typeof prepare>;
  try {
    pending = prepare();
    await pending;
  } catch {
    return null;
  }

  return {
    async signIn() {
      const request = await pending;
      let response: AppleSignInResponse;
      try {
        response = await api.signIn();
      } catch (e) {
        const code = (e as { error?: string } | null)?.error ?? "";
        if (CANCELLED.has(code)) return null;
        throw new AppleSignInError(code || String(e));
      } finally {
        // Un nonce ne sert qu'une fois : la demande suivante a le sien.
        pending = prepare();
        // Échec relu au prochain clic, pas une promesse rejetée sans témoin.
        pending.catch(() => undefined);
      }

      const auth = response?.authorization;
      if (!auth?.id_token) throw new AppleSignInError("missing id_token");
      if (auth.state !== request.state) throw new AppleSignInError("state mismatch");
      return { idToken: auth.id_token, rawNonce: request.rawNonce };
    },
  };
}
