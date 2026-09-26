/**
 * Clef maîtresse de la session, en mémoire seulement.
 *
 * Partagée entre le générateur (son champ clef) et l'écran carnet, qui s'ouvre
 * avec elle : il n'existe pas de mot de passe de carnet. Aucune empreinte de
 * la clef n'est stockée, nulle part. Voir shared/spec/vault-lock.md.
 */

import { ref } from "vue";

export const masterKey = ref("");

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

/** Déverrouille l'écran carnet avec la clef maîtresse. */
export function unlockWithMasterKey(typed: string): UnlockOutcome {
  if (!typed) return "empty";
  if (!masterKey.value) {
    masterKey.value = typed;
    return "keySet";
  }
  return sameMasterKey(typed, masterKey.value) ? "unlocked" : "otherKey";
}

/** Tests : chaque cas repart d'une session sans clef. */
export function resetMasterKeyForTests(): void {
  masterKey.value = "";
}
