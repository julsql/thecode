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

/** Clefs citees par le popup : attributs data-i18n* et appels a msg(). */
function usedKeys() {
  const html = read("popup.html");
  const js = read("popup.js");
  return new Set([
    ...[...html.matchAll(/data-i18n(?:-[a-z-]+)?="([a-z0-9_]+)"/g)].map((m) => m[1]),
    ...[...js.matchAll(/msg\(\s*"([a-z0-9_]+)"/g)].map((m) => m[1]),
    ...[...js.matchAll(/"(security_[a-z_]+)"/g)].map((m) => m[1]),
  ]);
}

describe("traductions du popup", () => {
  it.each(["en", "fr"])("toutes les clefs du popup existent en %s", (lang) => {
    const messages = locale(lang);
    expect([...usedKeys()].filter((key) => !messages[key])).toStrictEqual([]);
  });

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
});
