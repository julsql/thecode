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
const PRIVACY_UPDATED = "26 septembre 2026";
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

const termsDoc: LegalDoc = {
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

const privacyDoc: LegalDoc = {
  title: "Politique de confidentialité",
  updated: PRIVACY_UPDATED,
  intro: [
    "TheCode est un gestionnaire de mots de passe qui n'en stocke aucun : ils sont " +
      "recalculés sur votre appareil à partir de votre clef maîtresse. Cette page dit " +
      "exactement ce qui est collecté, et ce qui ne l'est pas.",
    "Sans compte, le service ne collecte rien du tout : la génération, le carnet et le " +
      "remplissage fonctionnent hors ligne, sans qu'aucun serveur soit contacté. Le compte " +
      "ne sert qu'à une chose, facultative : synchroniser votre carnet entre vos appareils.",
  ],
  sections: [
    {
      heading: "Responsable du traitement",
      paragraphs: [
        IDENTITY.editor
          ? `${IDENTITY.editor}, ${IDENTITY.address}. Contact : ${IDENTITY.email}.`
          : `Le responsable du traitement se joint à ${IDENTITY.email}.`,
      ],
    },
    {
      heading: "Ce que nous collectons, si vous créez un compte",
      items: [
        "votre adresse e-mail, qui identifie le compte, et la date à laquelle vous l'avez " +
          "confirmée ;",
        "votre mot de passe de compte, jamais en clair : seule une empreinte Argon2id est " +
          "conservée. Un compte ouvert avec Google ou Apple n'en a pas tant que vous n'en " +
          "définissez pas un ;",
        "si vous vous connectez avec Google : l'identifiant technique que Google nous " +
          "transmet et l'adresse associée, vérifiée par Google ;",
        "si vous vous connectez avec Apple : l'identifiant technique qu'Apple nous transmet " +
          "et l'adresse qu'Apple partage — celle de votre identifiant Apple, ou une adresse " +
          "relais privée si vous avez choisi de masquer la vôtre ;",
        "les appareils connectés : le nom de l'appareil tel que le système le donne (modèle " +
          "du téléphone, nom de l'iPhone ou du Mac, « extension », « site web »), le type de " +
          "client (application ou site), les dates de connexion et d'expiration et l'état de " +
          "la session. Le jeton de session n'est conservé qu'haché ;",
        "votre offre, son origine, l'état et la fin de période de votre abonnement, et vos " +
          "identifiants client et abonnement Stripe ;",
        "les codes d'invitation, de parrainage ou d'offre à vie que vous avez utilisés, et " +
          "leur date ;",
        "les liens envoyés par courrier (confirmation d'adresse, changement d'adresse, " +
          "réinitialisation du mot de passe) : un jeton haché, sa date d'expiration et, pour " +
          "un changement, la nouvelle adresse demandée ;",
        "votre carnet et vos réglages par défaut, chiffrés : le service reçoit des blocs " +
          "opaques qu'il ne peut pas déchiffrer. Seules les entrées que votre offre permet de " +
          "synchroniser sont envoyées ; les autres restent sur votre appareil ;",
        "des journaux techniques contenant votre adresse IP, conservés quelques jours pour " +
          "détecter les abus et diagnostiquer les pannes.",
      ],
    },
    {
      heading: "Ce que nous ne pouvons pas savoir",
      paragraphs: [
        "Le carnet et les réglages par défaut sont chiffrés sur votre appareil (AES-256-GCM) " +
          "avec une clef dérivée de votre clef maîtresse, que nous n'avons jamais. Nous ne " +
          "connaissons donc ni les sites que vous y enregistrez, ni vos identifiants, ni vos " +
          "réglages, ni vos mots de passe — qui ne sont d'ailleurs stockés nulle part.",
        "Votre clef maîtresse et le mot de passe qui verrouille l'écran du carnet ne quittent " +
          "jamais votre appareil. La biométrie (Face ID, Touch ID, empreinte) est vérifiée " +
          "par le système : nous n'en recevons rien.",
        "Ce que le service voit malgré tout, et qu'il faut énoncer plutôt que de laisser " +
          "croire à un secret parfait : le nombre d'entrées synchronisées, lesquelles " +
          "changent, la fréquence de vos synchronisations, le nombre de vos appareils et les " +
          "adresses IP depuis lesquelles ils se connectent.",
      ],
    },
    {
      heading: "Ce qui reste sur vos appareils",
      items: [
        "La clef maîtresse : dans le trousseau sur iPhone, iPad et Mac, chiffrée par le " +
          "Keystore sur Android. Dans l'extension, elle n'est gardée qu'en mémoire, pour la " +
          "session du navigateur, et s'efface à sa fermeture. Le site ne la conserve pas.",
        "Le carnet, les réglages et le verrou du carnet (une empreinte PBKDF2 du mot de " +
          "passe, jamais le mot de passe) : dans le stockage privé de l'application, ou dans " +
          "le stockage local de l'extension ou du navigateur.",
        "Le remplissage automatique (service de saisie automatique d'Android, fournisseur " +
          "d'identifiants iOS et macOS) : le système indique à TheCode le site ou l'app " +
          "concernée, le mot de passe est calculé sur l'appareil, et rien n'est envoyé.",
        "La caméra, sur téléphone, ne sert qu'à lire le QR code d'un carnet affiché sur un " +
          "autre appareil : aucune image n'est enregistrée ni envoyée.",
      ],
    },
    {
      heading: "L'extension de navigateur",
      paragraphs: ["L'extension demande les permissions suivantes, et n'en fait que cet usage :"],
      items: [
        "accès à tous les sites et script de page : repérer les champs de mot de passe et " +
          "proposer, à côté, celui calculé pour le site. La page n'est lue qu'autour de " +
          "ces champs (l'identifiant saisi compris), et rien n'en est conservé ni envoyé ;",
        "onglet actif : connaître le site de l'onglet ouvert quand vous cliquez sur " +
          "l'extension ;",
        "stockage : garder le carnet, les réglages et la session de synchronisation sur " +
          "l'appareil, et la clef maîtresse en mémoire le temps de la session du navigateur ;",
        "identité : uniquement pour « Continuer avec Google ». Google renvoie un jeton qui " +
          "contient votre identifiant et votre adresse, rien d'autre ; l'extension n'accède " +
          "à aucun autre service Google.",
      ],
    },
    {
      heading: "Pourquoi, et sur quelle base",
      items: [
        "Exécution du contrat : créer et tenir votre compte, synchroniser votre carnet, " +
          "vous envoyer les courriers liés au compte, gérer votre abonnement.",
        "Obligation légale : conserver les pièces de facturation.",
        "Intérêt légitime : protéger le service contre les abus, diagnostiquer les pannes.",
      ],
      paragraphs: [
        "Nous n'envoyons aucun courrier commercial : seulement ceux que le compte exige " +
          "(confirmation d'adresse, changement d'adresse, mot de passe oublié).",
      ],
    },
    {
      heading: "Qui d'autre y a accès",
      items: [
        "Stripe Payments Europe, Ltd. — paiement et facturation. Stripe reçoit votre " +
          "adresse e-mail, l'identifiant de votre compte et vos données de paiement, que " +
          "nous ne voyons jamais.",
        "Google Ireland Ltd. — uniquement si vous choisissez « Continuer avec Google ».",
        "Apple Distribution International Ltd. — uniquement si vous choisissez « Se " +
          "connecter avec Apple ».",
        "Notre fournisseur de messagerie, par lequel partent les courriers du compte : il " +
          "reçoit votre adresse et le contenu de ces courriers.",
        IDENTITY.host
          ? `Notre hébergeur, ${IDENTITY.host}, qui héberge le serveur dans l'Union ` +
            "européenne."
          : "Notre hébergeur, qui héberge le serveur dans l'Union européenne.",
      ],
      paragraphs: [
        "Vos données ne sont ni vendues, ni louées, ni transmises à des fins publicitaires. " +
          "Il n'y a aucun traceur, aucune mesure d'audience, aucun outil de suivi des " +
          "plantages et aucun cookie publicitaire, ni sur le site, ni dans les applications, " +
          "ni dans l'extension.",
        "Lorsqu'un sous-traitant traite des données hors de l'Union européenne, ce transfert " +
          "est encadré par les clauses contractuelles types de la Commission européenne.",
      ],
    },
    {
      heading: "Cookies et stockage local",
      paragraphs: [
        "Le site ne dépose aucun cookie. Votre carnet, vos réglages et votre session vivent " +
          "dans le stockage local de votre navigateur : ces données restent sur votre " +
          "appareil et ne sont jamais envoyées telles quelles.",
        "Les boutons « Continuer avec Google » et « Se connecter avec Apple » chargent un " +
          "script de Google ou d'Apple, et seulement sur la page du compte. Ces services " +
          "appliquent alors leurs propres règles, cookies compris.",
      ],
    },
    {
      heading: "Combien de temps",
      items: [
        "Compte, carnet, réglages, appareils et codes utilisés : tant que le compte existe. " +
          "La suppression est immédiate et définitive.",
        "Liens envoyés par courrier : valables 24 heures, 2 heures pour une " +
          "réinitialisation du mot de passe.",
        "Sessions d'appareil : 30 jours sans renouvellement, ou jusqu'à ce que vous " +
          "déconnectiez l'appareil.",
        "Sauvegardes de la base : sept jours au maximum.",
        "Journaux techniques : quelques jours.",
        "Pièces de facturation : dix ans, comme l'impose la loi comptable.",
      ],
    },
    {
      heading: "Vos droits",
      paragraphs: [
        "Depuis la page du compte, vous pouvez à tout moment : exporter l'intégralité de " +
          "vos données dans un fichier, voir et déconnecter vos appareils, corriger votre " +
          "adresse, changer votre mot de passe, délier Google ou Apple et supprimer " +
          "définitivement votre compte. La suppression résilie aussi l'abonnement.",
        "Le fichier exporté contient votre carnet tel que nous le gardons, c'est-à-dire " +
          "chiffré : seule votre clef maîtresse l'ouvre.",
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

/**
 * Les conditions de vente, précédées d'un avertissement tant que rien n'est
 * vendu : publier des conditions pour une offre qui n'existe pas tromperait
 * sur ce que le service propose.
 */
export const terms = (plansOpen: boolean): LegalDoc =>
  plansOpen
    ? termsDoc
    : {
        ...termsDoc,
        intro: [
          "Aucune offre payante n'est proposée à ce jour : tout le service est gratuit. Ces conditions s'appliqueront le jour où les abonnements ouvriront.",
          ...(termsDoc.intro || []),
        ],
      };

export const privacy = (plansOpen: boolean): LegalDoc =>
  plansOpen
    ? privacyDoc
    : {
        ...privacyDoc,
        intro: [
          ...(privacyDoc.intro || []),
          "Aucun paiement n'est proposé à ce jour : Stripe n'intervient donc pas encore, et aucune donnée ne lui est transmise.",
        ],
      };
