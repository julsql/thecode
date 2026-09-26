/**
 * Session de l'écran carnet : même grâce de 3 minutes que la clef.
 *
 * Quitter l'écran (autre page du site, onglet masqué ou fermé) fait courir la
 * fenêtre ; revenu à temps, le carnet est toujours ouvert. Seul l'instant de
 * sortie est retenu, dans sessionStorage (propre à l'onglet, vidé à sa
 * fermeture) : jamais un secret. Voir shared/spec/vault-lock.md, « Session ».
 */

export const VAULT_GRACE_MS = 3 * 60 * 1000;
export const VAULT_SESSION_KEY = "thecode.vaultLeftAt";

type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Vrai si une sortie à `leftAt` laisse le carnet ouvert à `now`. Une horloge
 * qui recule referme : on ne sait plus combien de temps s'est écoulé.
 */
export function isWithinGrace(
  leftAt: number | null,
  now: number,
  grace: number = VAULT_GRACE_MS,
): boolean {
  if (leftAt === null || !Number.isFinite(leftAt) || !Number.isFinite(now)) return false;
  const elapsed = now - leftAt;
  return elapsed >= 0 && elapsed <= grace;
}

/** sessionStorage peut manquer ou lever (navigation privée, cookies bloqués). */
function defaultStore(): SessionStore | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function readLeftAt(store: SessionStore): number | null {
  const raw = store.getItem(VAULT_SESSION_KEY);
  if (raw === null || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}

/** L'écran carnet déverrouillé vient d'être quitté. */
export function recordLeave(now: number = Date.now(), store = defaultStore()): void {
  try {
    store?.setItem(VAULT_SESSION_KEY, String(now));
  } catch {
    // Sans stockage, revenir redemandera le mot de passe : sûr.
  }
}

/** Vrai si le carnet est encore ouvert ; sinon efface l'instant. */
export function resumeSession(now: number = Date.now(), store = defaultStore()): boolean {
  try {
    if (!store) return false;
    const leftAt = readLeftAt(store);
    if (isWithinGrace(leftAt, now)) return true;
    store.removeItem(VAULT_SESSION_KEY);
  } catch {
    // Illisible : on reste verrouillé.
  }
  return false;
}

/** « Verrouiller », « Mot de passe oublié » : referme aussitôt. */
export function clearSession(store = defaultStore()): void {
  try {
    store?.removeItem(VAULT_SESSION_KEY);
  } catch {
    // Rien à effacer si le stockage est inaccessible.
  }
}
