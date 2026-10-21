/**
 * Métadonnées SEO des pages publiques, par langue.
 *
 * Source unique : lue au runtime par le routeur (seo.ts) et au build par le
 * plugin Vite qui écrit un index.html par route, pour que les robots sans
 * JavaScript reçoivent title, description, canonical et hreflang en dur.
 *
 * Aucune dépendance (ni Vue ni DOM) : vite.config.ts l'importe.
 */
export const SITE_ORIGIN = "https://thecode.julsql.fr";
export const SITE_NAME = "TheCode";
export const OG_IMAGE = `${SITE_ORIGIN}/logo.png`;
export const LANGS = ["en", "fr"] as const;
export type SeoLang = (typeof LANGS)[number];
export const OG_LOCALE: Record<SeoLang, string> = { en: "en_US", fr: "fr_FR" };

export interface PageMeta {
  title: string;
  description: string;
}

/** Clé = segment après la langue ("" pour l'accueil). */
export const PAGE_META: Record<string, Record<SeoLang, PageMeta>> = {
  "": {
    en: {
      title: "TheCode — Password generator that never stores passwords",
      description:
        "TheCode is a free, open-source password manager that stores nothing: it regenerates every password on the fly from a single secret key you remember.",
    },
    fr: {
      title: "TheCode — Générateur de mots de passe sans aucun stockage",
      description:
        "TheCode est un gestionnaire de mots de passe gratuit et open source qui ne stocke rien : il régénère vos mots de passe à partir d’une seule clef secrète.",
    },
  },
  generate: {
    en: {
      title: "Password generator — strong and deterministic | TheCode",
      description:
        "Generate a strong, deterministic password for any website, locally and with zero storage. With a single key, TheCode gives the same password every time.",
    },
    fr: {
      title: "Générateur de mot de passe fort et déterministe | TheCode",
      description:
        "Générez un mot de passe fort et déterministe pour chaque site, localement et sans stockage. Avec une seule clef, TheCode redonne toujours le même mot de passe.",
    },
  },
  tutorial: {
    en: {
      title: "Installation guide for every platform | TheCode",
      description:
        "How to install and activate TheCode on every platform: browser extensions, iPhone, Mac and Android. Pick your platform; each guide takes under a minute.",
    },
    fr: {
      title: "Guide d’installation sur chaque plateforme | TheCode",
      description:
        "Comment installer et activer TheCode sur chaque plateforme : extensions de navigateur, iPhone, Mac et Android. Chaque guide prend moins d’une minute.",
    },
  },
  about: {
    en: {
      title: "About TheCode — a simpler, safer way to handle passwords",
      description:
        "What TheCode is and how it works: a free, open-source password manager that never stores your passwords and regenerates them from one secret key.",
    },
    fr: {
      title: "Le projet TheCode — des mots de passe simples et plus sûrs",
      description:
        "Ce qu’est TheCode et comment il fonctionne : un gestionnaire de mots de passe libre et gratuit qui ne stocke rien et régénère tout depuis une seule clef.",
    },
  },
  pricing: {
    en: {
      title: "Plans and pricing — free generation, paid sync | TheCode",
      description:
        "Generating passwords with TheCode is free, forever, and works offline. A subscription only pays for syncing your password book between your devices.",
    },
    fr: {
      title: "Offres et tarifs — génération gratuite, synchro | TheCode",
      description:
        "Générer des mots de passe avec TheCode est gratuit, pour toujours, et fonctionne hors ligne. L’abonnement ne paie que la synchronisation de votre carnet.",
    },
  },
  contact: {
    en: {
      title: "Contact TheCode — questions, feedback and bug reports",
      description:
        "Questions, feedback or a bug to report about TheCode? Reach the team by email or on GitHub. We read everything, from feature ideas to security issues.",
    },
    fr: {
      title: "Contacter TheCode — questions, retours et signalements",
      description:
        "Une question, un retour ou un bug à signaler sur TheCode ? Écrivez à l’équipe par courriel ou sur GitHub. Nous lisons tout, des idées aux failles de sécurité.",
    },
  },
  privacy: {
    en: {
      title: "Privacy policy — what TheCode collects and why | TheCode",
      description:
        "TheCode privacy policy: what is collected if you create an account, what we cannot know, what stays on your devices, how long data is kept, and your rights.",
    },
    fr: {
      title: "Politique de confidentialité — vos données et TheCode",
      description:
        "Politique de confidentialité de TheCode : ce qui est collecté si vous créez un compte, ce qui reste sur vos appareils, les durées de conservation et vos droits.",
    },
  },
  terms: {
    en: {
      title: "Terms of sale — the TheCode sync subscription | TheCode",
      description:
        "TheCode terms of sale: what the service does, plans and prices, ordering and payment, cancellation, right of withdrawal, availability and governing law.",
    },
    fr: {
      title: "Conditions générales de vente de l’abonnement TheCode",
      description:
        "CGV de TheCode : ce que fait le service, les offres et les prix, la commande et le paiement, la résiliation, le droit de rétractation et le droit applicable.",
    },
  },
};

export const pageUrl = (lang: SeoLang, page: string): string =>
  `${SITE_ORIGIN}/${lang}${page ? `/${page}` : ""}`;

/** Résout la route courante ; null pour les pages privées ou inconnues. */
export function resolvePage(path: string): { lang: SeoLang; page: string } | null {
  const m = /^\/(en|fr)(?:\/([^/?#]*))?\/?$/.exec(path.split(/[?#]/)[0] ?? "");
  if (!m) return null;
  const page = m[2] ?? "";
  return page in PAGE_META ? { lang: m[1] as SeoLang, page } : null;
}

/** Balises <head> propres à une page, en HTML, pour le prérendu au build. */
export function headTags(lang: SeoLang, page: string): string {
  const meta = PAGE_META[page]![lang];
  const url = pageUrl(lang, page);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const other = LANGS.filter((l) => l !== lang);
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${pageUrl(l, page)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${pageUrl("en", page)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:width" content="480" />`,
    `<meta property="og:image:height" content="480" />`,
    `<meta property="og:image:alt" content="${SITE_NAME} logo" />`,
    `<meta property="og:locale" content="${OG_LOCALE[lang]}" />`,
    ...other.map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}" />`),
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
  ].join("\n    ");
}

export const SEO_PLACEHOLDER = "<!-- seo:page -->";

/** Injecte les balises d'une page dans le HTML de l'app (lang compris). */
export function renderPageHtml(html: string, lang: SeoLang, page: string): string {
  return html
    .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
    .replace(SEO_PLACEHOLDER, headTags(lang, page));
}

/** Toutes les pages publiques prérendues, avec leur chemin relatif de sortie. */
export const prerenderTargets = (): { lang: SeoLang; page: string; file: string }[] =>
  LANGS.flatMap((lang) =>
    Object.keys(PAGE_META).map((page) => ({
      lang,
      page,
      file: `${lang}${page ? `/${page}` : ""}/index.html`,
    })),
  );
