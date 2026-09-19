/**
 * Documents légaux, version française.
 *
 * Écrits pour ce service précis : ce qu'il fait, ce qu'il garde, ce qu'il ne
 * peut pas faire. Les formules vagues d'un modèle générique seraient fausses
 * ici — un gestionnaire de mots de passe qui ne stocke aucun mot de passe ne
 * ressemble à rien d'autre, et c'est ce qui doit se lire.
 *
 * À faire relire par un professionnel du droit avant d'encaisser le premier
 * paiement : ce texte est écrit avec soin, il n'est pas un conseil juridique.
 */

import { IDENTITY, PRICE } from "./identity";
import { missing, type LegalDoc } from "./types";

const UPDATED = "19 septembre 2026";
const price = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: PRICE.currency,
  minimumFractionDigits: PRICE.cents % 100 === 0 ? 0 : 2,
}).format(PRICE.cents / 100);

const f = (value: string) => missing(value, "fr");

export const legalNotice: LegalDoc = {
  title: "Mentions légales",
  updated: UPDATED,
  sections: [
    {
      heading: "Éditeur du site",
      items: [
        `Éditeur : ${f(IDENTITY.editor)}`,
        `Statut : ${f(IDENTITY.status)}`,
        `Adresse : ${f(IDENTITY.address)}`,
        `SIRET : ${f(IDENTITY.siret)}`,
        `TVA intracommunautaire : ${IDENTITY.vat || "non applicable (franchise en base de TVA)"}`,
        `Directeur de la publication : ${f(IDENTITY.director)}`,
        `Contact : ${IDENTITY.email}`,
      ],
    },
    {
      heading: "Hébergement",
      items: [`Hébergeur : ${f(IDENTITY.host)}`, `Adresse : ${f(IDENTITY.hostAddress)}`],
      paragraphs: [
        "Le site et le service de synchronisation sont hébergés sur un serveur situé dans " +
          "l'Union européenne.",
      ],
    },
    {
      heading: "Propriété intellectuelle",
      paragraphs: [
        "Le code source de TheCode est publié sous licence libre et reste consultable " +
          "publiquement. La marque, le nom et le logo demeurent la propriété de l'éditeur.",
        "L'algorithme de génération est documenté et volontairement reproductible : c'est " +
          "ce qui garantit que vos mots de passe ne dépendent pas de la survie de ce service.",
      ],
    },
    {
      heading: "Signaler un problème",
      paragraphs: [
        `Toute question, réclamation ou signalement peut être adressé à ${IDENTITY.email}. ` +
          "Une faille de sécurité peut être signalée à la même adresse ; elle sera traitée " +
          "en priorité.",
      ],
    },
  ],
};

export const terms: LegalDoc = {
  title: "Conditions générales de vente",
  updated: UPDATED,
  intro: [
    "Ces conditions régissent l'abonnement à l'offre complète de TheCode. L'offre gratuite " +
      "et la génération de mots de passe ne nécessitent ni compte ni paiement : elles ne " +
      "font l'objet d'aucune vente.",
  ],
  sections: [
    {
      heading: "1. Objet du service",
      paragraphs: [
        "TheCode calcule des mots de passe à partir d'une clef maîtresse que vous êtes seule " +
          "à connaître. Ces mots de passe ne sont stockés nulle part : ils sont recalculés à " +
          "chaque fois, sur votre appareil.",
        "Le service vendu est la **synchronisation** du carnet entre vos appareils, par le " +
          "serveur. Le carnet est chiffré sur votre appareil avant d'être envoyé : le service " +
          "ne peut lire ni vos sites, ni vos identifiants.",
      ],
    },
    {
      heading: "2. Offres et prix",
      items: [
        "Offre gratuite : génération illimitée et hors ligne, carnet local, synchronisation " +
          "limitée en nombre d'entrées et d'appareils.",
        `Offre complète : ${price} par mois, toutes taxes comprises, synchronisation sans ` +
          "ces limites.",
      ],
      paragraphs: [
        "Les prix sont indiqués toutes taxes comprises. Toute évolution tarifaire est " +
          "annoncée au moins un mois à l'avance et ne s'applique qu'aux périodes suivantes.",
      ],
    },
    {
      heading: "3. Commande et paiement",
      paragraphs: [
        "L'abonnement se souscrit depuis la page du compte, sur le site. Le paiement est " +
          "traité par Stripe Payments Europe, Ltd. Aucune donnée de carte bancaire ne " +
          "transite par nos serveurs ni n'y est conservée.",
        "L'abonnement est mensuel et reconduit tacitement chaque mois, jusqu'à résiliation.",
      ],
    },
    {
      heading: "4. Résiliation",
      paragraphs: [
        "Vous pouvez résilier à tout moment depuis la page du compte, sans motif et sans " +
          "frais. La résiliation prend effet à la fin de la période déjà payée : l'offre " +
          "complète reste active jusque-là.",
        "La suppression du compte entraîne la résiliation immédiate de l'abonnement.",
        "L'éditeur peut résilier un compte en cas d'usage manifestement abusif du service, " +
          "après information par courrier électronique, et rembourse alors la période " +
          "entamée au prorata.",
      ],
    },
    {
      heading: "5. Droit de rétractation",
      paragraphs: [
        "Vous disposez de quatorze jours à compter du premier paiement pour demander le " +
          "remboursement de votre abonnement, sans avoir à vous justifier, par simple " +
          `message à ${IDENTITY.email}.`,
        "Ce délai vous est accordé même lorsque le service a commencé à être fourni " +
          "immédiatement à votre demande : nous avons choisi de ne pas vous faire renoncer " +
          "à ce droit.",
      ],
    },
    {
      heading: "6. Disponibilité du service",
      paragraphs: [
        "Le service de synchronisation est fourni avec le soin d'un service en activité, " +
          "sans garantie contractuelle de disponibilité permanente. Des interruptions " +
          "peuvent survenir pour maintenance ou en cas d'incident.",
        "Une interruption du service de synchronisation ne vous empêche jamais d'utiliser " +
          "vos mots de passe : ils se calculent hors ligne, sur votre appareil, et votre " +
          "carnet reste sur celui-ci. C'est une propriété du service, pas une promesse " +
          "commerciale.",
      ],
    },
    {
      heading: "7. Vos responsabilités, et les nôtres",
      paragraphs: [
        "**Votre clef maîtresse ne peut pas être récupérée.** Le service ne la connaît pas, " +
          "ne la stocke pas et ne peut donc ni vous la rappeler, ni la réinitialiser. " +
          "L'oublier signifie perdre l'accès aux mots de passe qu'elle calcule. Le mot de " +
          "passe du compte, lui, se réinitialise : il ne protège que la synchronisation.",
        "Il vous revient de conserver votre clef maîtresse et de maintenir vos appareils à " +
          "jour. Il nous revient de protéger le service, de chiffrer ce qui transite et de " +
          "vous dire ce que nous gardons.",
        "La responsabilité de l'éditeur ne peut être engagée au-delà des sommes versées au " +
          "titre de l'abonnement sur les douze derniers mois, sauf faute lourde ou " +
          "dommage corporel, et sauf disposition légale impérative contraire.",
      ],
    },
    {
      heading: "8. Données personnelles",
      paragraphs: [
        "Le traitement de vos données est décrit dans la politique de confidentialité. " +
          "Vous pouvez à tout moment exporter vos données et supprimer votre compte depuis " +
          "la page du compte.",
      ],
    },
    {
      heading: "9. Modification des conditions",
      paragraphs: [
        "Toute modification substantielle de ces conditions est annoncée par courrier " +
          "électronique au moins un mois avant son entrée en vigueur. Vous restez libre de " +
          "résilier sans frais dans ce délai.",
      ],
    },
    {
      heading: "10. Droit applicable et litiges",
      paragraphs: [
        "Ces conditions sont soumises au droit français.",
        "En cas de différend, une solution amiable sera recherchée en premier lieu. " +
          `Un consommateur peut ensuite recourir gratuitement au médiateur de la ` +
          `consommation : ${f(IDENTITY.mediator)}. À défaut d'accord, les tribunaux ` +
          "compétents sont ceux désignés par les règles de droit commun.",
      ],
    },
  ],
};

export const privacy: LegalDoc = {
  title: "Politique de confidentialité",
  updated: UPDATED,
  intro: [
    "TheCode est un gestionnaire de mots de passe qui n'en stocke aucun : ils sont " +
      "recalculés sur votre appareil à partir de votre clef maîtresse. Cette page dit " +
      "exactement ce qui est collecté, et ce qui ne l'est pas.",
    "Sans compte, le service ne collecte rien du tout : la génération, le carnet et le " +
      "remplissage fonctionnent hors ligne, sans qu'aucun serveur soit contacté.",
  ],
  sections: [
    {
      heading: "Responsable du traitement",
      paragraphs: [`${f(IDENTITY.editor)}, ${f(IDENTITY.address)}. Contact : ${IDENTITY.email}.`],
    },
    {
      heading: "Ce que nous collectons, si vous créez un compte",
      items: [
        "votre adresse e-mail, qui identifie le compte ;",
        "votre mot de passe de compte, jamais en clair : seule une empreinte Argon2id est " +
          "conservée ;",
        "si vous vous connectez avec Google : l'identifiant technique que Google nous " +
          "transmet, et l'adresse associée ;",
        "les appareils connectés : un libellé que vous choisissez, les dates de connexion " +
          "et d'expiration ;",
        "votre offre, l'état de votre abonnement et votre identifiant client Stripe ;",
        "votre carnet, chiffré : le service reçoit des blocs opaques qu'il ne peut pas " +
          "déchiffrer ;",
        "des journaux techniques contenant votre adresse IP, conservés quelques jours pour " +
          "détecter les abus et diagnostiquer les pannes.",
      ],
    },
    {
      heading: "Ce que nous ne pouvons pas savoir",
      paragraphs: [
        "Le carnet est chiffré sur votre appareil avec une clef dérivée de votre clef " +
          "maîtresse, que nous n'avons jamais. Nous ne connaissons donc ni les sites que " +
          "vous y enregistrez, ni vos identifiants, ni vos réglages, ni vos mots de passe.",
        "Ce que le service voit malgré tout, et qu'il faut énoncer plutôt que de laisser " +
          "croire à un secret parfait : le nombre d'entrées de votre carnet, lesquelles " +
          "changent, et la fréquence de vos synchronisations.",
      ],
    },
    {
      heading: "Pourquoi, et sur quelle base",
      items: [
        "Exécution du contrat : créer et tenir votre compte, synchroniser votre carnet, " +
          "gérer votre abonnement.",
        "Obligation légale : conserver les pièces de facturation.",
        "Intérêt légitime : protéger le service contre les abus, diagnostiquer les pannes.",
      ],
    },
    {
      heading: "Qui d'autre y a accès",
      items: [
        "Stripe Payments Europe, Ltd. — paiement et facturation. Stripe reçoit votre " +
          "adresse e-mail et vos données de paiement, que nous ne voyons jamais.",
        "Google Ireland Ltd. — uniquement si vous choisissez « Continuer avec Google ».",
        `Notre hébergeur, ${f(IDENTITY.host)}, qui héberge le serveur dans l'Union ` +
          "européenne.",
      ],
      paragraphs: [
        "Vos données ne sont ni vendues, ni louées, ni transmises à des fins publicitaires. " +
          "Il n'y a aucun traceur, aucune mesure d'audience, aucun cookie publicitaire.",
        "Lorsqu'un sous-traitant traite des données hors de l'Union européenne, ce transfert " +
          "est encadré par les clauses contractuelles types de la Commission européenne.",
      ],
    },
    {
      heading: "Cookies et stockage local",
      paragraphs: [
        "Le site ne dépose aucun cookie. Votre carnet et votre session vivent dans le " +
          "stockage local de votre navigateur : ces données restent sur votre appareil et " +
          "ne sont jamais envoyées telles quelles.",
      ],
    },
    {
      heading: "Combien de temps",
      items: [
        "Compte et carnet : tant que le compte existe. La suppression est immédiate et " +
          "définitive.",
        "Sauvegardes de la base : sept jours au maximum.",
        "Journaux techniques : quelques jours.",
        "Pièces de facturation : dix ans, comme l'impose la loi comptable.",
      ],
    },
    {
      heading: "Vos droits",
      paragraphs: [
        "Depuis la page du compte, vous pouvez à tout moment : exporter l'intégralité de " +
          "vos données dans un fichier, corriger votre adresse, changer votre mot de passe " +
          "et supprimer définitivement votre compte.",
        "Vous disposez également des droits d'accès, de rectification, d'effacement, de " +
          "limitation, d'opposition et de portabilité prévus par le RGPD. Pour les exercer " +
          `autrement que depuis le site : ${IDENTITY.email}.`,
        "Vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr) si vous " +
          "estimez que vos droits ne sont pas respectés.",
      ],
    },
    {
      heading: "En cas de faille",
      paragraphs: [
        "Si une violation de données survenait, les personnes concernées et l'autorité de " +
          "contrôle seraient informées dans les délais prévus par le RGPD. Le chiffrement " +
          "du carnet côté appareil est précisément ce qui fait qu'une telle fuite ne " +
          "livrerait pas son contenu.",
      ],
    },
  ],
};
