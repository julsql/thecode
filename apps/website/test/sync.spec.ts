/**
 * Client de synchronisation.
 *
 * L'essentiel ici est l'interopérabilité : un carnet chiffré par le site doit
 * être lisible par le CLI et l'extension, sinon la synchronisation entre
 * appareils ne veut rien dire.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KDF_ITERATIONS, KDF_SALT, deriveTransferKey } from "@/transfer";
import { clearSession, loadSession, saveSession, SyncError, syncVault } from "@/sync";
import { emptyVault, newEntry, type Vault } from "@/vault";

const here = dirname(fileURLToPath(import.meta.url));
const vector = JSON.parse(readFileSync(join(here, "transfer-vector.json"), "utf8"));
const syncVector = JSON.parse(readFileSync(join(here, "sync-row.json"), "utf8"));

const SESSION = {
  endpoint: "https://example.test/api",
  accessToken: "a",
  refreshToken: "r",
};

/**
 * Serveur de carnet en mémoire, aux mêmes règles que l'API réelle.
 *
 * Ce qui compte est ce que le navigateur envoie, et le fait que deux appareils
 * convergent. Un vrai serveur ne dirait rien de plus.
 */
function fakeServer() {
  const rows = new Map<string, Record<string, unknown>>();
  const sent: string[] = [];
  let revision = 0;

  const json = (status: number, body: unknown) =>
    Promise.resolve({
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
    } as Response);

  const fetchImpl = (url: string, init?: RequestInit) => {
    if (!init?.body) return json(200, { revision, entries: [...rows.values()] });

    sent.push(init.body as string);
    const payload = JSON.parse(init.body as string);
    if (payload.base_revision !== revision) {
      // Écraser reviendrait à perdre en silence ce qu'un autre appareil a
      // écrit entre-temps.
      return json(409, { detail: `révision ${revision}` });
    }
    revision += 1;
    for (const row of payload.entries) rows.set(row.entry_id, row);
    return json(200, { revision, accepted: payload.entries.length });
  };

  return {
    fetchImpl,
    sent,
    get revision() {
      return revision;
    },
  };
}

function vaultWith(siteKey: string, login: string): Vault {
  const vault = emptyVault();
  vault.entries.push(newEntry(siteKey, { domains: [siteKey], login }));
  return vault;
}

describe("clef de transfert", () => {
  it("utilise le sel et le coût de la spécification partagée", () => {
    // Un sel différent d'une implémentation à l'autre rendrait les carnets
    // mutuellement illisibles, sans que rien ne le signale.
    expect(KDF_SALT).toBe("thecode-transfer/v1");
    expect(KDF_ITERATIONS).toBe(600000);
  });

  it("déchiffre un payload produit par une autre implémentation", async () => {
    const key = await deriveTransferKey(vector.masterKey);

    const raw = vector.payload.split(".");
    const b64d = (t: string) => {
      const s = t.replace(/-/g, "+").replace(/_/g, "/");
      const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
      return Uint8Array.from(bin, (c) => c.charCodeAt(0));
    };

    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64d(raw[1]) },
      key,
      b64d(raw[2]),
    );

    // Le payload partagé est compressé : on vérifie que le déchiffrement
    // aboutit, la décompression étant couverte côté CLI.
    expect(new Uint8Array(plain).length).toBeGreaterThan(0);
  });
});

describe("session", () => {
  beforeEach(() => clearSession());

  it("survit à un rechargement", () => {
    saveSession({ endpoint: "https://x", accessToken: "a", refreshToken: "r" });
    expect(loadSession()?.accessToken).toBe("a");
  });

  it("rend null quand il n'y en a pas", () => {
    expect(loadSession()).toBeNull();
  });

  it("s'oublie à la déconnexion", () => {
    saveSession({ endpoint: "https://x", accessToken: "a", refreshToken: "r" });
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it("ne casse pas sur un contenu corrompu", () => {
    // Mode privé, stockage bricolé : la page doit continuer de fonctionner.
    localStorage.setItem("thecode.session", "pas du json");
    expect(loadSession()).toBeNull();
  });
});

describe("erreurs", () => {
  it("expose un type dédié", () => {
    expect(new SyncError("x")).toBeInstanceOf(Error);
  });
});

describe("synchronisation", () => {
  let server: ReturnType<typeof fakeServer>;

  beforeEach(() => {
    server = fakeServer();
    vi.stubGlobal("fetch", server.fetchImpl);
  });

  it("n'envoie rien de lisible sur le réseau", async () => {
    await syncVault(vaultWith("banque-secrete.fr", "juliette"), "clef", SESSION);

    expect(server.sent.length).toBeGreaterThan(0);
    for (const body of server.sent) {
      // Le serveur ne doit rien apprendre : ni le site, ni l'identifiant.
      expect(body).not.toContain("banque-secrete");
      expect(body).not.toContain("juliette");
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
    // La représentation canonique départage les écritures simultanées :
    // écrire « deleted: false » ici ferait désigner un gagnant différent des
    // autres implémentations, et les carnets ne convergeraient jamais.
    await syncVault(vaultWith("google.com", "moi"), "clef", SESSION);
    const merged = await syncVault(emptyVault(), "clef", SESSION);

    expect(merged.vault.entries[0]).not.toHaveProperty("deleted");
  });

  it("propage une suppression", async () => {
    const phone = await syncVault(vaultWith("google.com", "moi"), "clef", SESSION);
    const id = phone.vault.entries[0].id;
    phone.vault.entries[0].deleted = true;
    phone.vault.entries[0].updatedAt = "2999-01-01T00:00:00Z";
    await syncVault(phone.vault, "clef", SESSION);

    const laptop = await syncVault(vaultWith("google.com", "moi"), "clef", SESSION);
    expect(laptop.vault.entries.find((e) => e.id === id)?.deleted).toBe(true);
  });

  it("refuse une autre clef maîtresse plutôt que de rendre n'importe quoi", async () => {
    await syncVault(vaultWith("google.com", "moi"), "clef", SESSION);

    await expect(syncVault(emptyVault(), "mauvaise", SESSION)).rejects.toThrow(/clef ma[îi]tresse/);
  });

  it("signale une révision périmée au lieu d'écraser", async () => {
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
      Promise.resolve({
        ok: !init?.body,
        status: init?.body ? 409 : 200,
        json: () =>
          Promise.resolve(init?.body ? { detail: "révision 4" } : { revision: 3, entries: [] }),
      } as Response),
    );

    await expect(syncVault(emptyVault(), "clef", SESSION)).rejects.toThrow(/409/);
  });

  it("déchiffre une ligne produite par une autre implémentation", async () => {
    // Ce qui a déjà cassé n'est pas le chiffrement mais le JSON autour : un
    // champ inventé, un défaut ajouté, et la fusion diverge.
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            init?.body ? { revision: 1, accepted: 1 } : { revision: 0, entries: [syncVector.row] },
          ),
      } as Response),
    );

    const merged = await syncVault(emptyVault(), syncVector.masterKey, SESSION);
    expect(merged.vault.entries[0]).toStrictEqual(syncVector.entry);
  });
});
