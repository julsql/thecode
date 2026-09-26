/**
 * Traductions des pages de l'extension (popup, ecran carnet).
 *
 * Les pages suivent la langue du navigateur ; le francais du HTML et des
 * chaines de secours reste en place quand l'API manque (tests) ou qu'une clef
 * n'existe pas.
 */
if (typeof browser === "undefined" && typeof chrome !== "undefined") {
  var browser = chrome;
}

function i18nApi() {
  return typeof browser !== "undefined" ? browser.i18n : undefined;
}

/** Message traduit. `values` remplit $1, $2… dans l'ordre. */
function msg(key, fallback, ...values) {
  const subs = values.map(String);
  const text = i18nApi()?.getMessage(key, subs.length ? subs : undefined);
  return text || subs.reduce((out, v, i) => out.replace(`$${i + 1}`, v), fallback);
}

/** Langue de l'interface, pour les dates. */
function uiLocale() {
  return i18nApi()?.getUILanguage?.() || "fr-FR";
}

/**
 * Traduit la page d'apres ses attributs data-i18n*. Le francais du HTML reste
 * en place pour toute clef absente.
 */
function translatePage() {
  document.documentElement.lang = uiLocale().split("-")[0];
  const attributes = {
    i18n: null,
    i18nAriaLabel: "aria-label",
    i18nTitle: "title",
    i18nHref: "href",
  };
  for (const [data, attribute] of Object.entries(attributes)) {
    const selector = `[data-${data.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`;
    document.querySelectorAll(selector).forEach((el) => {
      const text = i18nApi()?.getMessage(el.dataset[data]);
      if (!text) return;
      if (attribute) el.setAttribute(attribute, text);
      else el.textContent = text;
    });
  }
}

if (typeof module !== "undefined") {
  module.exports = { msg, uiLocale, translatePage };
}
