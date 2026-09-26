/**
 * Menu dans la page : l'identifiant deja saisi dans le formulaire entre dans
 * le calcul, comme dans la popup, sans changer le mot de passe d'un compte
 * enregistre sans identifiant.
 */
const path = require("node:path");
const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;

const { generatePasswordV2 } = require("../core-v2");

const PAGE = { tab: { id: 7, url: "https://example.com/login" }, url: "https://example.com/login" };
const sampleKey = "clef-de-demonstration";

function loadWorker() {
  const store = {};
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
        remove: async (keys) =>
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]),
      },
      onChanged: { addListener: () => {} },
    },
  };
  global.browser = global.chrome;
  jest.resetModules();
  require(path.join(__dirname, "..", "background.js"));
  const send = (request, sender = {}) =>
    new Promise((resolve) => listeners[0](request, sender, resolve));
  return { send, store };
}

async function ready() {
  const w = loadWorker();
  await w.send({ action: "setEncodingKey", encodingKey: sampleKey });
  return w;
}

const pageGenerate = (send, login) =>
  send({ action: "generatePassword", url: PAGE.url, login }, PAGE);

describe("menu dans la page et identifiant", () => {
  it("fait entrer l'identifiant saisi pour un site inconnu", async () => {
    const { send } = await ready();

    const res = await pageGenerate(send, "moi");

    expect(res.password).toBe(
      await generatePasswordV2("example.com", sampleKey, 20, { login: "moi" }),
    );
  });

  it("garde le mot de passe d'un compte enregistre sans identifiant", async () => {
    const { send } = await ready();
    const before = await pageGenerate(send, undefined);
    await send({ action: "saveCurrentSite" }, PAGE);

    const after = await pageGenerate(send, "moi");

    expect(after.password).toBe(before.password);
  });

  it("traite un autre identifiant comme un autre compte", async () => {
    const { send, store } = await ready();
    await send({ action: "saveCurrentSite", login: "premier" }, PAGE);

    const res = await pageGenerate(send, "second");
    await send({ action: "saveCurrentSite", login: "second" }, PAGE);

    expect(res.password).toBe(
      await generatePasswordV2("example.com", sampleKey, 20, { login: "second" }),
    );
    const logins = store.vault.entries.map((e) => e.login).sort();
    expect(logins).toEqual(["premier", "second"]);
  });

  it("ne demande jamais la v1 depuis la page", async () => {
    const { send } = await ready();
    const res = await send(
      { action: "generatePassword", url: PAGE.url, version: 1, login: "moi" },
      PAGE,
    );
    expect(res.password).toBe(
      await generatePasswordV2("example.com", sampleKey, 20, { login: "moi" }),
    );
  });
});
