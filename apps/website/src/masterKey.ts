/**
 * Clef maîtresse de la session, en mémoire seulement.
 *
 * Partagée entre le générateur (son champ clef) et l'écran carnet, qui s'ouvre
 * avec elle : il n'existe pas de mot de passe de carnet. Aucune empreinte de
 * la clef n'est stockée, nulle part. Voir shared/spec/vault-lock.md.
 *
 * « Verrouiller » ferme toute la session : la clef reste en mémoire mais ne
 * sert plus à rien (ni génération, ni carnet, ni synchronisation) tant
 * qu'elle n'a pas été ressaisie.
 */

import { computed, ref } from "vue";
import { clearSession } from "@/vaultSession";

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

/** Tests : chaque cas repart d'une session sans clef. */
export function resetMasterKeyForTests(): void {
  forgetMasterKey();
}
