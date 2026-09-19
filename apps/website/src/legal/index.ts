/**
 * Accès aux documents légaux dans la langue courante.
 *
 * Le français fait foi : le service est exploité depuis la France et vendu sous
 * droit français. La version anglaise est une traduction de courtoisie, et
 * chaque document le dit lui-même plutôt que de laisser croire le contraire.
 */

import * as en from "./en";
import * as fr from "./fr";
import type { LegalDoc } from "./types";

export type LegalKind = "legalNotice" | "terms" | "privacy";

export function legalDoc(kind: LegalKind, lang: string, plansOpen = false): LegalDoc {
  const source = lang === "fr" ? fr : en;
  if (kind === "legalNotice") return source.legalNotice;
  return source[kind](plansOpen);
}

export type { LegalDoc } from "./types";
