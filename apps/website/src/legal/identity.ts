/**
 * Identité de l'éditeur, telle qu'elle doit figurer sur les pages légales.
 *
 * ⚠️ À COMPLÉTER avant d'ouvrir les paiements. Ces informations sont
 * obligatoires pour un site qui vend un service en France (article 6 de la LCEN
 * pour les mentions légales, article L. 221-5 du code de la consommation pour la
 * vente à distance). Tant qu'un champ est vide, la page affiche « à compléter »
 * — c'est volontairement visible : une mention légale inventée serait pire
 * qu'une mention manquante.
 *
 * Rien ici n'est deviné : ces valeurs ne sont connues que de l'éditrice.
 */
export interface Identity {
  /** Nom et prénom, ou dénomination sociale. */
  editor: string;
  /** Forme juridique, ex. « entrepreneur individuel » ou « SAS au capital de 1 000 € ». */
  status: string;
  /** Adresse du siège ou de l'établissement. */
  address: string;
  /** Numéro SIRET. */
  siret: string;
  /** Numéro de TVA intracommunautaire. Vide si franchise en base de TVA. */
  vat: string;
  /** Directeur ou directrice de la publication. */
  director: string;
  /** Adresse de contact, publique. */
  email: string;
  /** Hébergeur du site : dénomination. */
  host: string;
  /** Hébergeur : adresse postale et téléphone. */
  hostAddress: string;
  /** Médiateur de la consommation : nom et site. Obligatoire pour vendre à des particuliers. */
  mediator: string;
}

export const IDENTITY: Identity = {
  editor: "",
  status: "",
  address: "",
  siret: "",
  vat: "",
  director: "",
  email: "contact@thecode.julsql.fr",
  host: "",
  hostAddress: "",
  mediator: "",
};

/** Ce que le prix affiché vaut, en centimes, et sa devise. */
export const PRICE = { cents: 200, currency: "EUR" };
