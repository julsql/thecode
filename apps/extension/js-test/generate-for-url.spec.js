/**
 * Generation pour la page courante : ce que content.js appelle.
 *
 * Sans le carnet, ce chemin prenait le domaine tel quel avec les reglages
 * generaux : les trois problemes d'usage restaient entiers ici, et une entree
 * v2 recevait un mot de passe v1 — faux, sans que rien ne le signale.
 */
const path = require("node:path");
const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;

/**
 * Charge le service worker avec un stockage a nous.
 *
 * `browser` est resolu a la premiere ligne de background.js depuis `chrome` :
 * il faut donc poser le global AVANT de charger le module, et remettre a zero
 * le registre de modules de jest entre deux tests.
 */
function loadWorker() {
  const store = {};
  global.chrome = {
    runtime: { onMessage: { addListener: () => {} }, getURL: (p) => `chrome-extension://x/${p}` },
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
  const worker = require(path.join(__dirname, "..", "background.js"));
  worker.setEncodingKeyForTests("clef");
  return { worker, storage: global.chrome.storage.local };
}

describe("generation pour une page", () => {
  it("retombe sur les reglages generaux pour un site inconnu", async () => {
    const { worker } = loadWorker();

    const res = await worker.generatePasswordForUrl("https://inconnu.fr/login");
    const { mdp } = await worker.generatePassword("inconnu.fr", "clef", 20, true, true, true, true);

    expect(res.password).toBe(mdp);
  });

  it("applique les reglages enregistres pour le site", async () => {
    // Le deuxieme probleme : ne plus avoir a se souvenir qu'un site n'accepte
    // pas les symboles.
    const { worker, storage } = loadWorker();
    const { emptyVault, newEntry, saveVault } = require("../vault");

    const vault = emptyVault();
    vault.entries.push(
      newEntry("banque.fr", {
        domains: ["banque.fr"],
        length: 12,
        charset: { lower: true, upper: true, symbols: false, numbers: true },
      }),
    );
    await saveVault(storage, vault);

    const res = await worker.generatePasswordForUrl("https://banque.fr/login");

    expect(res.password).toHaveLength(12);
    expect(res.password).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it("suit un alias jusqu'au siteKey de l'entree", async () => {
    // Le troisieme probleme : google.fr doit rendre le mot de passe de
    // google.com, pas un autre.
    const { worker, storage } = loadWorker();
    const { emptyVault, newEntry, saveVault } = require("../vault");

    const vault = emptyVault();
    vault.entries.push(newEntry("google.com", { domains: ["google.com", "google.fr"] }));
    await saveVault(storage, vault);

    const viaAlias = await worker.generatePasswordForUrl("https://google.fr/login");
    const direct = await worker.generatePasswordForUrl("https://google.com/login");

    expect(viaAlias.password).toBe(direct.password);
  });

  it("derive en v2 quand l'entree est en v2", async () => {
    const { worker, storage } = loadWorker();
    const { emptyVault, newEntry, saveVault } = require("../vault");
    const { generatePasswordV2 } = require("../core-v2");

    const vault = emptyVault();
    vault.entries.push(newEntry("google.com", { domains: ["google.com"], v: 2 }));
    await saveVault(storage, vault);

    const res = await worker.generatePasswordForUrl("https://google.com/login");

    expect(res.password).toBe(await generatePasswordV2("google.com", "clef", 20));
    // Et surtout : ce n'est pas le mot de passe v1.
    const { mdp } = await worker.generatePassword("google.com", "clef", 20, true, true, true, true);
    expect(res.password).not.toBe(mdp);
  });

  it("rend le login quand le carnet le connait", async () => {
    const { worker, storage } = loadWorker();
    const { emptyVault, newEntry, saveVault } = require("../vault");

    const vault = emptyVault();
    vault.entries.push(
      newEntry("google.com", { domains: ["google.com"], login: "moi@example.fr" }),
    );
    await saveVault(storage, vault);

    const res = await worker.generatePasswordForUrl("https://google.com/login");

    // Il fait partie de ce qu'on ne devait plus avoir a retenir.
    expect(res.login).toBe("moi@example.fr");
  });
});

describe("renouvellement et migration", () => {
  it("prepare le changement sans rien ecrire", async () => {
    const { worker, storage } = loadWorker();
    const { emptyVault, newEntry, saveVault, loadVault } = require("../vault");

    const vault = emptyVault();
    const entry = newEntry("google.com", { domains: ["google.com"], v: 2 });
    vault.entries.push(entry);
    await saveVault(storage, vault);

    const before = await worker.passwordForEntry(entry);
    const after = await worker.passwordForEntry(entry, entry.counter + 1, entry.v);

    // Le nouveau ne sert a rien tant qu'il n'a pas ete pose sur le site, et
    // l'ancien reste celui qui connecte : les deux doivent etre calculables
    // avant toute ecriture.
    expect(before).not.toBe(after);
    expect((await loadVault(storage)).entries[0].counter).toBe(1);
  });

  it("migrer change le mot de passe", async () => {
    const { worker } = loadWorker();
    const { newEntry } = require("../vault");

    const entry = newEntry("google.com", { domains: ["google.com"] });

    // C'est pourquoi la migration s'affiche avec les deux mots de passe : il
    // faudra aller changer celui du site.
    expect(await worker.passwordForEntry(entry)).not.toBe(
      await worker.passwordForEntry(entry, entry.counter, 2),
    );
  });

  it("le compteur n'a aucun effet en v1", async () => {
    const { worker } = loadWorker();
    const { newEntry } = require("../vault");

    const entry = newEntry("google.com", { domains: ["google.com"] });

    // D'ou le fait de ne proposer que la migration sur une entree v1.
    expect(await worker.passwordForEntry(entry)).toBe(await worker.passwordForEntry(entry, 5, 1));
  });
});

describe("transfert du carnet par le service worker", () => {
  it("refuse d'exporter un carnet vide", async () => {
    const { worker } = loadWorker();
    // Un QR d'un carnet vide n'aurait rien a transporter.
    expect(await worker.exportVaultPayload()).toMatchObject({ ok: false });
  });

  it("chiffre le carnet et le relit", async () => {
    const { worker, storage } = loadWorker();
    const { emptyVault, newEntry, saveVault } = require("../vault");

    const vault = emptyVault();
    vault.entries.push(newEntry("banque-secrete.fr", { domains: ["banque-secrete.fr"] }));
    await saveVault(storage, vault);

    const exported = await worker.exportVaultPayload();
    expect(exported.ok).toBe(true);
    expect(exported.payload.startsWith("TC1.")).toBe(true);
    // Rien de lisible : c'est ce qui rend une photo de l'ecran inoffensive.
    expect(exported.payload).not.toContain("banque-secrete");

    const { importVault } = require("../transfer");
    const back = await importVault(exported.payload, "clef");
    expect(back.entries[0].siteKey).toBe("banque-secrete.fr");
  });

  it("fusionne un import au lieu de remplacer", async () => {
    const { worker, storage } = loadWorker();
    const { emptyVault, newEntry, saveVault, loadVault } = require("../vault");
    const { exportVault } = require("../transfer");

    // Ce qui arrive.
    const incoming = emptyVault();
    incoming.entries.push(newEntry("github.com", { domains: ["github.com"] }));
    const payload = await exportVault(incoming, "clef");

    // Ce qui est deja la.
    const local = emptyVault();
    local.entries.push(newEntry("google.com", { domains: ["google.com"] }));
    await saveVault(storage, local);

    const result = await worker.importVaultPayload(payload);
    expect(result.ok).toBe(true);

    // Un import qui ecraserait effacerait les entrees creees ici.
    const merged = await loadVault(storage);
    expect(merged.entries.map((e) => e.siteKey).sort()).toStrictEqual(["github.com", "google.com"]);
  });
});

describe("enregistrement propose depuis la page", () => {
  it("dit si le site est deja connu", async () => {
    const { worker, storage } = loadWorker();
    const { emptyVault, newEntry, saveVault } = require("../vault");

    // Inconnu : il y a quelque chose a proposer.
    expect((await worker.generatePasswordForUrl("https://inconnu.fr/x")).known).toBe(false);

    const vault = emptyVault();
    vault.entries.push(newEntry("google.com", { domains: ["google.com"] }));
    await saveVault(storage, vault);

    // Connu : le reproposer serait du bruit.
    expect((await worker.generatePasswordForUrl("https://google.com/x")).known).toBe(true);
  });

  it("prend le domaine de l'onglet, pas celui que la page annonce", async () => {
    // C'est la garde qui rend cette action ouverte aux scripts de page : une
    // page hostile ne peut faire enregistrer qu'elle-meme.
    const { worker, storage } = loadWorker();
    const { loadVault } = require("../vault");

    const resp = await worker.saveCurrentSite(
      { tab: { url: "https://banque.fr/login" } },
      "moi@example.fr",
    );

    expect(resp.ok).toBe(true);
    const entry = (await loadVault(storage)).entries[0];
    expect(entry.siteKey).toBe("banque.fr");
    expect(entry.login).toBe("moi@example.fr");
  });

  it("refuse sans onglet", async () => {
    const { worker } = loadWorker();
    // Un message sans onglet ne vient pas d'une page : rien a enregistrer.
    expect(await worker.saveCurrentSite({}, "")).toMatchObject({ ok: false });
  });

  it("met a jour sans jamais reecrire le siteKey", async () => {
    const { worker, storage } = loadWorker();
    const { emptyVault, newEntry, saveVault, loadVault } = require("../vault");

    const vault = emptyVault();
    vault.entries.push(
      newEntry("google.com", { domains: ["google.com", "google.fr"], length: 32 }),
    );
    await saveVault(storage, vault);

    const resp = await worker.saveCurrentSite({ tab: { url: "https://google.fr/login" } }, "");

    expect(resp.updated).toBe(true);
    const entries = (await loadVault(storage)).entries;
    // Une seule entree, et sa clef de derivation intacte : la reecrire
    // changerait un mot de passe deja en service.
    expect(entries).toHaveLength(1);
    expect(entries[0].siteKey).toBe("google.com");
  });

  it("borne un login venu de la page", async () => {
    const { worker, storage } = loadWorker();
    const { loadVault } = require("../vault");

    await worker.saveCurrentSite({ tab: { url: "https://x.fr/login" } }, "a".repeat(500));

    // Un champ de page peut contenir n'importe quoi.
    expect((await loadVault(storage)).entries[0].login).toHaveLength(120);
  });
});
