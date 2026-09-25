/**
 * Renouvellement d'une entrée du carnet, partagé par le générateur et l'écran
 * carnet.
 *
 * Deux temps : on montre l'ancien et le nouveau mot de passe, puis on écrit
 * le compteur une fois le changement fait sur le site. Écrire d'abord rendrait
 * le compte inaccessible.
 */

import { generatePassword } from "@/utils";
import { generatePasswordV2 } from "@/coreV2";
import { loadVault, saveVault, type VaultEntry } from "@/vault";

/**
 * Dérive le mot de passe d'une entrée.
 *
 * Une entrée ne porte pas de version : elle dérive en v2. `version` = 1 ne sert
 * qu'à la génération ponctuelle demandée depuis l'écran réglé en v1.
 */
export async function passwordForEntry(
  entry: VaultEntry,
  clef: string,
  counter?: number,
  version?: number,
): Promise<string | null> {
  if (version !== 1) {
    return generatePasswordV2(entry.siteKey, clef, entry.length, {
      useLower: entry.charset.lower,
      useUpper: entry.charset.upper,
      useSymbols: entry.charset.symbols,
      useNumbers: entry.charset.numbers,
      login: entry.login ?? "",
      counter: counter ?? entry.counter,
    });
  }
  // v1 : ni login ni compteur n'entrent dans la dérivation.
  return generatePassword(
    entry.siteKey,
    clef,
    entry.length,
    entry.charset.lower,
    entry.charset.upper,
    entry.charset.symbols,
    entry.charset.numbers,
  );
}

export interface RenewProposal {
  entryId: string;
  before: string;
  after: string;
}

/** Prépare un renouvellement, sans rien écrire. */
export async function proposeRenewal(entry: VaultEntry, clef: string): Promise<RenewProposal> {
  return {
    entryId: entry.id,
    before: (await passwordForEntry(entry, clef)) ?? "",
    after: (await passwordForEntry(entry, clef, entry.counter + 1)) ?? "",
  };
}

/**
 * Applique un renouvellement confirmé : compteur + 1 et rehorodatage.
 *
 * Sans rehorodatage, la fusion ferait gagner l'autre appareil et le
 * changement serait perdu à la synchronisation suivante.
 */
export function applyRenewal(entryId: string): VaultEntry | null {
  const vault = loadVault();
  const entry = vault.entries.find((e) => e.id === entryId && !e.deleted);
  if (!entry) return null;
  entry.counter += 1;
  entry.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  saveVault(vault);
  return entry;
}
