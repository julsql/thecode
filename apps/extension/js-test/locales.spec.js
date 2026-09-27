/**
 * Traductions du popup.
 *
 * Le popup suit la langue du navigateur. Une clef absente d'une langue laisse
 * le francais du HTML en place : on obtient un popup a moitie traduit, sans
 * erreur ni avertissement. D'ou ces verifications.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const locale = (lang) => JSON.parse(read(`_locales/${lang}/messages.json`));

/** Le HTML sans ses commentaires, retires jusqu'a ce qu'il n'en reste aucun. */
function withoutComments(html) {
  let previous;
  let out = html;
  do {
    previous = out;
    out = out.replace(/<!--[\s\S]*?-->/g, "");
  } while (out !== previous);
  return out.replaceAll("<!--", "");
}

/** Clefs citees par une page : attributs data-i18n* et appels a msg(). */
function usedKeys(page) {
  const html = fs.existsSync(path.join(root, `${page}.html`)) ? read(`${page}.html`) : "";
  const js = read(`${page}.js`);
  return new Set([
    ...[...html.matchAll(/data-i18n(?:-[a-z-]+)?="([a-z0-9_]+)"/g)].map((m) => m[1]),
    ...[...js.matchAll(/msg\(\s*"([a-z0-9_]+)"/g)].map((m) => m[1]),
    ...[...js.matchAll(/"((?:security|vault_charset)_[a-z_]+)"/g)].map((m) => m[1]),
  ]);
}

describe("traductions du popup", () => {
  it.each([
    ["popup", "en"],
    ["popup", "fr"],
    ["vault-page", "en"],
    ["vault-page", "fr"],
    ["transfer-page", "en"],
    ["transfer-page", "fr"],
    ["content", "en"],
    ["content", "fr"],
  ])("toutes les clefs de %s existent en %s", (page, lang) => {
    const messages = locale(lang);
    expect([...usedKeys(page)].filter((key) => !messages[key])).toStrictEqual([]);
  });

  it("l'ecran carnet charge les traductions et en cite", () => {
    expect(read("vault-page.html")).toMatch(/<script src="i18n.js" defer><\/script>/);
    expect(usedKeys("vault-page").size).toBeGreaterThan(40);
  });

  it.each(["vault-page", "transfer-page"])(
    "aucun texte visible de %s n'echappe a la traduction",
    (page) => {
      // Tout element feuille porteur de texte doit avoir un data-i18n (siteKey
      // excepte : c'est le nom technique du champ).
      const html = withoutComments(read(`${page}.html`));
      const leaves = [...html.matchAll(/<([a-z0-9]+)([^>]*)>([^<]+)<\/\1>/g)]
        .filter(([, , , text]) => text.trim() && text.trim() !== "siteKey")
        .filter(([, , attrs]) => !attrs.includes("data-i18n"));
      expect(leaves.map(([whole]) => whole)).toStrictEqual([]);
    },
  );

  it("l'anglais et le francais ont les memes clefs", () => {
    expect(Object.keys(locale("en")).sort()).toStrictEqual(Object.keys(locale("fr")).sort());
  });

  it("les deux langues attendent les memes valeurs", () => {
    const en = locale("en");
    const fr = locale("fr");
    for (const key of Object.keys(en)) {
      expect([key, Object.keys(en[key].placeholders ?? {}).sort()]).toStrictEqual([
        key,
        Object.keys(fr[key]?.placeholders ?? {}).sort(),
      ]);
    }
  });

  it("le lien vers le compte suit la langue", () => {
    expect(locale("en").popup_account_url.message).toContain("/en/");
    expect(locale("fr").popup_account_url.message).toContain("/fr/");
  });

  it.each(["en", "fr"])("la description tient dans la limite de Chrome en %s", (lang) => {
    const description = locale(lang).extension_description.message;
    expect(description.length).toBeLessThanOrEqual(132);
    // Faux depuis le carnet et la synchronisation.
    expect(description).not.toMatch(/no storage|aucun stockage|no risk|zéro risque/i);
    // Ce qui distingue TheCode vient en premier.
    expect(description).toMatch(/^(Passwords never stored|Mots de passe jamais stockés)/);
  });

  it.each(["en", "fr"])("aucun texte n'oriente vers une offre payante en %s", (lang) => {
    const forbidden =
      /offre|free plan|full plan|paid plan|premium|abonn|subscri|upgrade|débloquer|tarif|pricing|€/i;
    const offending = Object.entries(locale(lang))
      .filter(([, { message }]) => forbidden.test(message))
      .map(([key]) => key);
    expect(offending).toStrictEqual([]);
  });

  it("la page de transfert charge les traductions", () => {
    expect(read("transfer-page.html")).toMatch(/<script src="i18n.js" defer><\/script>/);
    expect(read("transfer-page.js")).toMatch(/translatePage\(\)/);
  });

  it("le menu dans la page n'a plus de texte en dur", () => {
    // Chaque texte montre passe par msg() : pas de chaine francaise nue
    // affectee a innerText, ni de bouton libelle en dur.
    const js = read("content.js");
    expect(js).not.toMatch(/innerText = "[^"]*[a-zé]/);
    expect(js).not.toMatch(/button\("[A-Z]/);
    expect(js).not.toMatch(/fontFamily = "font-family"/);
  });
});
