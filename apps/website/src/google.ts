/**
 * Bouton « Continuer avec Google ».
 *
 * Le script vient de chez Google : il est chargé à la demande, seulement sur
 * la page du compte et seulement si le service annonce un identifiant client.
 * Le charger sur tout le site ferait passer chaque visiteur par Google pour
 * lire une page publique, ce qui n'a rien à y faire.
 *
 * Tout échec est silencieux et rend `false` : la page doit continuer à
 * proposer l'adresse et le mot de passe. Un bouton Google qui ne répond pas
 * serait pire que pas de bouton.
 */

const SCRIPT_URL = "https://accounts.google.com/gsi/client";

interface GoogleIdApi {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (r: { credential: string }) => void;
      }): void;
      renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdApi;
  }
}

let loading: Promise<boolean> | null = null;

function loadScript(): Promise<boolean> {
  if (loading) return loading;

  loading = new Promise<boolean>((resolve) => {
    if (typeof document === "undefined") {
      resolve(false);
      return;
    }
    if (window.google?.accounts?.id) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(Boolean(window.google?.accounts?.id));
    // Bloqueur de traqueurs, réseau coupé, Google indisponible : la page
    // continue avec l'adresse et le mot de passe.
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return loading;
}

/**
 * Affiche le bouton Google dans `parent` et appelle `onToken` au retour.
 *
 * Rend `false` quand le bouton n'a pas pu être posé, pour que l'appelant cache
 * la zone plutôt que de laisser un trou.
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  clientId: string,
  onToken: (idToken: string) => void,
  locale = "en",
): Promise<boolean> {
  if (!clientId) return false;
  if (!(await loadScript())) return false;

  const api = window.google?.accounts?.id;
  if (!api) return false;

  try {
    api.initialize({
      client_id: clientId,
      callback: (response) => onToken(response.credential),
    });
    api.renderButton(parent, {
      theme: "filled_black",
      size: "large",
      width: 280,
      locale,
      text: "continue_with",
    });
    return true;
  } catch {
    return false;
  }
}
