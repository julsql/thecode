/**
 * Client de synchronisation.
 *
 * Ce qui compte est ce que l'extension envoie sur le reseau, et le fait que
 * deux appareils convergent. Un vrai serveur ne dirait rien de plus et rendrait
 * les tests lents et instables.
 */
const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;

const {
  syncVault,
  SyncError,
  deriveSyncBits,
  deriveSyncKey,
  decryptEntry,
  encryptEntry,
  openSettings,
} = require("../sync");
const { emptyVault, newEntry } = require("../vault");

const vector = require("./sync-row.json");
const SESSION = {
  endpoint: "https://example.test/api",
  accessToken: "a",
  refreshToken: "r",
  kdfSalt: vector.kdfSalt,
};
const saltBytes = (text) => new Uint8Array(Buffer.from(text, "base64url"));

/** Serveur de carnet en memoire, aux memes regles que l'API reelle. */
function fakeServer(maxEntries) {
  const rows = new Map();
  const sent = [];
  let revision = 0;

  const reply = (status, body) =>
    Promise.resolve({
      ok: status < 400,
      status,
      statusText: String(status),
      json: () => Promise.resolve(body),
    });

  const fetchImpl = (url, init) => {
    if (!init?.body) {
      return reply(200, {
        revision,
        entries: [...rows.values()],
        ...(maxEntries === undefined ? {} : { max_entries: maxEntries }),
      });
    }

    sent.push(init.body);
    const payload = JSON.parse(init.body);
    if (payload.base_revision !== revision) {
      // Ecraser reviendrait a perdre en silence ce qu'un autre appareil a
      // ecrit entre-temps.
      return reply(409, { detail: `revision ${revision}` });
    }
    revision += 1;
    for (const row of payload.entries) rows.set(row.entry_id, row);
    return reply(200, { revision, accepted: payload.entries.length });
  };

  return {
    fetchImpl,
    sent,
    get revision() {
      return revision;
    },
  };
}

function vaultWith(siteKey, login) {
  const v = emptyVault();
  v.entries.push(newEntry(siteKey, { domains: [siteKey], login }));
  return v;
}

describe("synchronisation", () => {
  let server;

  beforeEach(() => {
    server = fakeServer();
    global.fetch = server.fetchImpl;
  });

  it("n'envoie rien de lisible sur le reseau", async () => {
    await syncVault(vaultWith("banque-secrete.fr", "utilisateur"), "clef", SESSION);

    expect(server.sent.length).toBeGreaterThan(0);
    for (const body of server.sent) {
      // Le serveur ne doit rien apprendre : ni le site, ni l'identifiant.
      expect(body).not.toContain("banque-secrete");
      expect(body).not.toContain("utilisateur");
    }
  });

  it("fait converger deux appareils", async () => {
    const phone = await syncVault(vaultWith("google.com", "moi"), "clef", SESSION);
    const laptop = await syncVault(vaultWith("github.com", "julsql"), "clef", SESSION);
    const again = await syncVault(phone.vault, "clef", SESSION);

    expect(laptop.vault.entries).toHaveLength(2);
    expect(again.vault.entries.map((e) => e.siteKey).sort()).toStrictEqual([
      "github.com",
      "google.com",
    ]);
  });

  it("laisse absent un deleted qui vaut faux", async () => {
    // La representation canonique departage les ecritures simultanees :
    // ecrire « deleted: false » ici ferait designer un gagnant different des
    // autres implementations, et les carnets ne convergeraient jamais.
    await syncVault(vaultWith("google.com", "moi"), "clef", SESSION);
    const merged = await syncVault(emptyVault(), "clef", SESSION);

    expect(merged.vault.entries[0]).not.toHaveProperty("deleted");
  });

  it("au-dela du plafond, ne pousse que les plus anciennes", async () => {
    server = fakeServer(2);
    global.fetch = server.fetchImpl;
    const vault = emptyVault();
    for (const [site, created] of [
      ["recent.fr", "2026-03-01T00:00:00Z"],
      ["ancien.fr", "2026-01-01T00:00:00Z"],
      ["moyen.fr", "2026-02-01T00:00:00Z"],
    ]) {
      vault.entries.push({ ...newEntry(site), createdAt: created });
    }

    const result = await syncVault(vault, "clef", SESSION);

    const pushed = JSON.parse(server.sent[0]).entries.map((row) => row.entry_id);
    const bySite = (site) => vault.entries.find((e) => e.siteKey === site).id;
    expect(pushed.sort()).toStrictEqual([bySite("ancien.fr"), bySite("moyen.fr")].sort());
    // L'entree en trop reste dans le carnet local.
    expect(result.localOnly).toBe(1);
    expect(result.vault.entries).toHaveLength(3);
  });

  it("propage une suppression", async () => {
    const phone = await syncVault(vaultWith("google.com", "moi"), "clef", SESSION);
    const id = phone.vault.entries[0].id;
    phone.vault.entries[0].deleted = true;
    phone.vault.entries[0].updatedAt = "2999-01-01T00:00:00Z";
    await syncVault(phone.vault, "clef", SESSION);

    const laptop = await syncVault(vaultWith("google.com", "moi"), "clef", SESSION);
    expect(laptop.vault.entries.find((e) => e.id === id).deleted).toBe(true);
  });

  it("refuse une autre clef maitresse plutot que de rendre n'importe quoi", async () => {
    await syncVault(vaultWith("google.com", "moi"), "clef", SESSION);

    await expect(syncVault(emptyVault(), "mauvaise", SESSION)).rejects.toThrow(/clef maitresse/);
  });

  it("signale une revision perimee au lieu d'ecraser", async () => {
    global.fetch = (url, init) =>
      Promise.resolve({
        ok: !init?.body,
        status: init?.body ? 409 : 200,
        statusText: "409",
        json: () =>
          Promise.resolve(init?.body ? { detail: "revision 4" } : { revision: 3, entries: [] }),
      });

    await expect(syncVault(emptyVault(), "clef", SESSION)).rejects.toThrow(/409/);
  });

  it("signale un service injoignable", async () => {
    global.fetch = () => Promise.reject(new Error("DNS introuvable"));

    await expect(syncVault(emptyVault(), "clef", SESSION)).rejects.toThrow(/injoignable/);
  });

  it("dechiffre une ligne produite par une autre implementation", async () => {
    // Ce qui a deja casse n'est pas le chiffrement mais le JSON autour : un
    // champ invente, un defaut ajoute, et la fusion diverge.
    global.fetch = (url, init) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            init?.body ? { revision: 1, accepted: 1 } : { revision: 0, entries: [vector.row] },
          ),
      });

    const merged = await syncVault(emptyVault(), vector.masterKey, SESSION);
    expect(merged.vault.entries[0]).toStrictEqual(vector.entry);
  });

  it("expose une erreur dediee", () => {
    expect(new SyncError("x")).toBeInstanceOf(Error);
  });

  it("relit le sel du compte sur /v1/auth/me quand la session ne l'a pas", async () => {
    const calls = [];
    global.fetch = (url, init) => {
      calls.push(url);
      if (url.endsWith("/v1/auth/me")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ plan: "free", kdf_salt: vector.kdfSalt }),
        });
      }
      return server.fetchImpl(url, init);
    };
    const { kdfSalt, ...withoutSalt } = SESSION;

    const result = await syncVault(vaultWith("google.com", "moi"), "clef", withoutSalt);

    expect(calls[0]).toMatch(/\/v1\/auth\/me$/);
    expect(result.session.kdfSalt).toBe(kdfSalt);
  });

  it.each([
    ["absent", undefined],
    ["trop court", "AAAA"],
    ["pas du base64url", "!!!!!!!!!!!!!!!!!!!!!!"],
  ])("ne synchronise pas sans sel valide (%s)", async (_name, salt) => {
    global.fetch = (url, init) =>
      url.endsWith("/v1/auth/me")
        ? Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ kdf_salt: salt }),
          })
        : server.fetchImpl(url, init);

    await expect(
      syncVault(vaultWith("google.com", "moi"), "clef", { ...SESSION, kdfSalt: salt }),
    ).rejects.toThrow(/sel de derivation/);
    expect(server.sent).toHaveLength(0);
  });
});

describe("vecteurs de synchronisation v2 (sync-row.json)", () => {
  let key;
  beforeAll(async () => {
    key = await deriveSyncKey(vector.masterKey, saltBytes(vector.kdfSalt));
  });

  it("derive la meme clef que les autres implementations", async () => {
    const bits = await deriveSyncBits(vector.masterKey, saltBytes(vector.kdfSalt));
    expect(Buffer.from(bits).toString("hex")).toBe(vector.derivedSyncHex);
  });

  it("dechiffre la ligne de reference", async () => {
    expect(await decryptEntry(vector.row, key)).toStrictEqual(vector.entry);
  });

  it("ouvre les reglages de reference", async () => {
    expect(await openSettings(vector.settings.sealed, key)).toStrictEqual(vector.settings.value);
  });

  it("chiffre une entree que l'on sait relire, liee a son identifiant", async () => {
    const row = await encryptEntry(vector.entry, key);
    expect(row.entry_id).toBe(vector.entry.id);
    expect(await decryptEntry(row, key)).toStrictEqual(vector.entry);
    await expect(decryptEntry({ ...row, entry_id: "autre" }, key)).rejects.toThrow(SyncError);
  });

  it("couvre chaque cas refuse", () => {
    expect(vector.rejected.length).toBeGreaterThan(0);
  });

  it.each(vector.rejected.map((c) => [c.name, c]))("refuse %s", async (_name, c) => {
    const open = c.as === "settings" ? openSettings(c.row, key) : decryptEntry(c.row, key);
    await expect(open).rejects.toThrow(SyncError);
  });
});
