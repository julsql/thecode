/**
 * Forme d'un document légal.
 *
 * Les textes vivent en données plutôt qu'en gabarit : ils changent pour des
 * raisons qui n'ont rien à voir avec l'affichage — un changement de statut, un
 * sous-traitant de plus — et il vaut mieux relire un texte juridique dans un
 * fichier de texte que dans du HTML.
 */
export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
}

export interface LegalDoc {
  title: string;
  /** Date de dernière mise à jour, écrite en toutes lettres. */
  updated: string;
  intro?: string[];
  sections: LegalSection[];
}

/** Ce qu'on affiche à la place d'une information que l'éditrice doit fournir. */
export const missing = (value: string, lang: string): string =>
  value || (lang === "fr" ? "à compléter" : "to be completed");
