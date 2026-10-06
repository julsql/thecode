/**
 * Identifiants proposes pour un site : ceux qui servent deja ailleurs dans le
 * carnet. Ils viennent d'autres sites : rien ne sort sans clef utilisable.
 */
const path = require("node:path");
const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;

const { loginSuggestions, newEntry } = require("../vault");

const entry = (site, login, extra = {}) => ({
  ...newEntry(site, { domains: [site], login }),
  ...extra,
});

const VAULT = {
  schema: 1,
  entries: [
    entry("a.fr", "zoe"),
    entry("b.fr", "moi@exemple.fr"),
    entry("c.fr", " moi@exemple.fr "),
    entry("d.fr", "alice"),
    entry("e.fr", ""),
    entry("vieux.fr", "ancien", { deleted: true }),
    entry("site.fr", "alice"),
  ],
};

describe("identifiants proposes", () => {
  it("classe par usage, sans ceux que le site a deja", () => {
    // « alice » est deja un compte du site.
    expect(loginSuggestions(VAULT, "site.fr")).toStrictEqual(["moi@exemple.fr", "zoe"]);
  });

  it("departage par ordre alphabetique et borne la liste", () => {
    expect(loginSuggestions(VAULT, "autre.fr", 2)).toStrictEqual(["alice", "moi@exemple.fr"]);
  });

  it("ne propose rien d'un carnet vide", () => {
    expect(loginSuggestions({ schema: 1, entries: [] }, "site.fr")).toStrictEqual([]);
  });
});

describe("identifiants proposes par le service worker", () => {
  const PAGE = {
    tab: { id: 7, url: "https://www.autre.fr/login" },
    url: "https://www.autre.fr/login",
  };

  function loadWorker() {
    const store = { vault: VAULT };
    const listeners = [];
    global.chrome = {
      runtime: {
        getURL: (p) => `chrome-extension://x/${p}`,
        onMessage: { addListener: (fn) => listeners.push(fn) },
      },
      storage: {
        local: {
          get: async (keys) =>
            Object.fromEntries(
              (Array.isArray(keys) ? keys : [keys])
                .filter((k) => k in store)
                .map((k) => [k, store[k]]),
            ),
          set: async (obj) => Object.assign(store, obj),
          remove: async () => {},
        },
        onChanged: { addListener: () => {} },
      },
    };
    global.browser = global.chrome;
    global.fetch = jest.fn(() => Promise.reject(new Error("hors ligne")));
    jest.resetModules();
    require(path.join(__dirname, "..", "background.js"));
    return (request, sender) => new Promise((resolve) => listeners[0](request, sender, resolve));
  }

  it("ne dit rien sans clef, ni session verrouillee", async () => {
    const send = loadWorker();
    expect((await send({ action: "loginSuggestions" }, PAGE)).logins).toStrictEqual([]);

    await send({ action: "setEncodingKey", encodingKey: "clef" }, {});
    await send({ action: "lockSession" }, {});
    expect((await send({ action: "loginSuggestions" }, PAGE)).logins).toStrictEqual([]);
  });

  it("repond pour le site de l'onglet, pas pour celui que la page pretend", async () => {
    const send = loadWorker();
    await send({ action: "setEncodingKey", encodingKey: "clef" }, {});

    const fromPage = await send({ action: "loginSuggestions", domain: "site.fr" }, PAGE);
    expect(fromPage.logins).toStrictEqual(["alice", "moi@exemple.fr", "zoe"]);

    // La popup, elle, dit le site qu'elle affiche.
    const fromPopup = await send({ action: "loginSuggestions", domain: "site.fr" }, {});
    expect(fromPopup.logins).toStrictEqual(["moi@exemple.fr", "zoe"]);
  });
});
