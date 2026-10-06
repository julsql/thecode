/**
 * Clef maîtresse de la session, en mémoire tant que la page vit.
 *
 * Partagée entre le générateur (son champ clef) et l'écran carnet, qui s'ouvre
 * avec elle : il n'existe pas de mot de passe de carnet. Aucune empreinte de
 * la clef n'est stockée, nulle part. Voir shared/spec/vault-lock.md.
 *
 * Recharger la page ne la fait pas ressaisir : elle est confiée à
 * sessionStorage au moment où la page se ferme, et reprise au chargement
 * suivant s'il vient dans la grâce de 3 minutes (`installKeyKeeper`).
 *
 * « Verrouiller » ferme toute la session : la clef reste en mémoire mais ne
 * sert plus à rien (ni génération, ni carnet, ni synchronisation) tant
 * qu'elle n'a pas été ressaisie.
 */

import { computed, ref } from "vue";
import { clearSession, isWithinGrace } from "@/vaultSession";

export const masterKey = ref("");

/** Session verrouillée : la clef est gardée mais inutilisable. */
export const locked = ref(false);

/** La clef à utiliser : vide tant que la session est verrouillée. */
export const usableMasterKey = computed(() => (locked.value ? "" : masterKey.value));

/**
 * Vrai si les deux clefs sont identiques. Comparaison en temps constant : la
 * durée ne dépend que de la plus longue, jamais de la position du premier
 * octet différent.
 */
export function sameMasterKey(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  const n = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/**
 * - `unlocked` : la clef saisie est celle de la session ;
 * - `keySet` : aucune clef n'était définie, la saisie devient celle de la
 *   session (le générateur l'utilise ensuite) ;
 * - `otherKey` : ce n'est pas la clef en cours d'utilisation ;
 * - `empty` : rien de saisi.
 */
export type UnlockOutcome = "unlocked" | "keySet" | "otherKey" | "empty";

/**
 * Déverrouille avec la clef maîtresse : l'écran carnet, et toute la session
 * si elle était verrouillée.
 */
export function unlockWithMasterKey(typed: string): UnlockOutcome {
  if (!typed) return "empty";
  if (!masterKey.value) {
    masterKey.value = typed;
    locked.value = false;
    return "keySet";
  }
  if (!sameMasterKey(typed, masterKey.value)) return "otherKey";
  locked.value = false;
  return "unlocked";
}

/**
 * « Verrouiller » : toute la session, et la grâce de l'écran carnet avec.
 * Sans clef, il n'y a rien à verrouiller : rend faux.
 */
export function lockSession(): boolean {
  clearSession();
  if (!masterKey.value) return false;
  locked.value = true;
  return true;
}

/** « Effacer » : oublie la clef, et le verrou avec elle. */
export function forgetMasterKey(): void {
  masterKey.value = "";
  locked.value = false;
}

/** Où la clef attend le chargement suivant : propre à l'onglet. */
export const KEPT_KEY = "thecode.keptKey";

type KeyStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** sessionStorage peut manquer ou lever (navigation privée, cookies bloqués). */
function keyStore(): KeyStore | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * La page se ferme : confie la clef au chargement suivant. Une session
 * verrouillée ou sans clef ne confie rien, et efface ce qui attendait.
 */
export function keepMasterKey(now: number = Date.now(), store = keyStore()): void {
  try {
    if (!masterKey.value || locked.value) store?.removeItem(KEPT_KEY);
    else store?.setItem(KEPT_KEY, JSON.stringify({ key: masterKey.value, leftAt: now }));
  } catch {
    // Sans stockage, recharger redemandera la clef : sûr.
  }
}

/**
 * Reprend la clef confiée par la page précédente, si elle l'a été il y a
 * moins de 3 minutes. Elle est effacée du stockage dans tous les cas : elle
 * n'y reste que le temps d'un rechargement.
 */
export function restoreMasterKey(now: number = Date.now(), store = keyStore()): boolean {
  try {
    const raw = store?.getItem(KEPT_KEY);
    store?.removeItem(KEPT_KEY);
    if (!raw || masterKey.value) return false;
    const kept = JSON.parse(raw) as { key?: unknown; leftAt?: unknown };
    if (typeof kept.key !== "string" || !kept.key || typeof kept.leftAt !== "number") return false;
    if (!isWithinGrace(kept.leftAt, now)) return false;
    masterKey.value = kept.key;
    locked.value = false;
    return true;
  } catch {
    return false;
  }
}

/** Au chargement du site : reprend la clef, et la confiera à la fermeture. */
export function installKeyKeeper(): void {
  restoreMasterKey();
  window.addEventListener("pagehide", () => keepMasterKey());
  // Page ressortie du cache du navigateur : sa mémoire est intacte, la copie
  // n'a plus de raison d'attendre.
  window.addEventListener("pageshow", () => {
    try {
      keyStore()?.removeItem(KEPT_KEY);
    } catch {
      // Rien à effacer si le stockage est inaccessible.
    }
  });
}

/** Tests : chaque cas repart d'une session sans clef. */
export function resetMasterKeyForTests(): void {
  forgetMasterKey();
}
