import type { Router } from "vue-router";

// Mesure d'audience (Umami, pages vues) limitee aux pages publiques.
//
// Les pages qui manipulent la clef maitresse, les mots de passe generes, le
// carnet ou les identifiants du compte ne chargent jamais le traceur : un
// script tiers dans le meme contexte JS pourrait lire le DOM et les champs
// saisis. Comme le site est une SPA, un traceur charge sur une page publique
// resterait en memoire apres une navigation interne : passer d'une page
// publique (traceur charge) a une page sensible force donc un rechargement
// complet, qui repart d'un contexte sans traceur.

export const UMAMI_SRC = "https://stats.julsql.fr/js/app.js";
export const UMAMI_WEBSITE_ID = "8f00c79a-c8d8-4322-979e-4c99846608fa";
export const UMAMI_DOMAINS = "thecode.julsql.fr";

const SENSITIVE = /^\/(?:(?:en|fr)\/)?(?:generate|vault|legacy|account)(?:\/|$)/;

export function isTrackedPath(path: string): boolean {
  return !SENSITIVE.test(path);
}

export function trackerLoaded(doc: Document = document): boolean {
  return doc.querySelector(`script[src="${UMAMI_SRC}"]`) !== null;
}

export function loadTracker(doc: Document = document): void {
  if (trackerLoaded(doc)) return;
  const script = doc.createElement("script");
  script.defer = true;
  script.src = UMAMI_SRC;
  script.dataset.websiteId = UMAMI_WEBSITE_ID;
  script.dataset.domains = UMAMI_DOMAINS;
  doc.head.appendChild(script);
}

export function installAnalytics(
  router: Router,
  doc: Document = document,
  reload: (path: string) => void = (path) => window.location.assign(path),
): void {
  router.beforeEach((to) => {
    if (isTrackedPath(to.path) || !trackerLoaded(doc)) return true;
    reload(to.fullPath);
    return false;
  });
  router.afterEach((to) => {
    if (isTrackedPath(to.path)) loadTracker(doc);
  });
}
