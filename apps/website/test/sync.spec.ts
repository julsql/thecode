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
import {
  clearSession,
  googleSignIn,
  login,
  loadSession,
  register,
  registrationState,
  saveSession,
  SyncError,
  syncVault,
} from "@/sync";
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
function fakeServer(maxEntries?: number) {
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
    if (!init?.body) {
      return json(200, {
        revision,
        entries: [...rows.values()],
        ...(maxEntries === undefined ? {} : { max_entries: maxEntries }),
      });
    }

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
    // La représentation canonique départage les écritures simultanées :
    // écrire « deleted: false » ici ferait désigner un gagnant différent des
    // autres implémentations, et les carnets ne convergeraient jamais.
    await syncVault(vaultWith("google.com", "moi"), "clef", SESSION);
    const merged = await syncVault(emptyVault(), "clef", SESSION);

    expect(merged.vault.entries[0]).not.toHaveProperty("deleted");
  });

  it("au-delà du plafond, ne pousse que les plus anciennes", async () => {
    server = fakeServer(2);
    vi.stubGlobal("fetch", server.fetchImpl);
    const vault = emptyVault();
    for (const [site, created] of [
      ["recent.fr", "2026-03-01T00:00:00Z"],
      ["ancien.fr", "2026-01-01T00:00:00Z"],
      ["moyen.fr", "2026-02-01T00:00:00Z"],
    ]) {
      vault.entries.push({ ...newEntry(site), createdAt: created });
    }

    const result = await syncVault(vault, "clef", SESSION);

    const pushed = JSON.parse(server.sent[0]).entries.map(
      (row: { entry_id: string }) => row.entry_id,
    );
    const bySite = (site: string) => vault.entries.find((e) => e.siteKey === site)!.id;
    expect(pushed.sort()).toStrictEqual([bySite("ancien.fr"), bySite("moyen.fr")].sort());
    // L'entrée en trop reste dans le carnet local.
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

describe("inscription", () => {
  it("dit combien de places restent sans code", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ open: true, needsCode: false, freeSlots: 3 }),
      } as Response),
    );

    const state = await registrationState("https://example.test/api");
    expect(state).toStrictEqual({ open: true, needsCode: false, freeSlots: 3 });
  });

  it("crée un compte et rend une session utilisable", async () => {
    let sent: unknown = null;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      sent = JSON.parse(init!.body as string);
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ access_token: "a", refresh_token: "r" }),
      } as Response);
    });

    const session = await register(
      "https://example.test/api",
      "moi@example.fr",
      "mot-de-passe-de-test",
      "parrainage",
    );

    // Le code part tel quel : c'est le serveur qui décide s'il est requis.
    expect(sent).toMatchObject({
      email: "moi@example.fr",
      invite_code: "parrainage",
      client: "web",
    });
    expect(session).toStrictEqual({
      endpoint: "https://example.test/api",
      accessToken: "a",
      refreshToken: "r",
    });
  });

  it("remonte le refus du serveur plutôt que de l'avaler", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ detail: "Code de parrainage invalide." }),
      } as Response),
    );

    await expect(register("https://example.test/api", "moi@example.fr", "x")).rejects.toThrow(
      /parrainage/,
    );
  });
});

describe("sessions du site", () => {
  // Le site est l'endroit où l'on déconnecte un appareil : il s'annonce comme
  // tel, pour que le plafond d'appareils ne lui ferme jamais la porte.
  function capture(): Array<{ url: string; body: unknown }> {
    const bodies: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      bodies.push({ url, body: JSON.parse(init!.body as string) });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ access_token: "a", refresh_token: "r" }),
      } as Response);
    });
    return bodies;
  }

  it("se connecte en tant que site", async () => {
    const bodies = capture();
    await login("https://example.test/api", "moi@example.fr", "phrase-de-test");

    expect(bodies[0].url).toBe("https://example.test/api/v1/auth/login");
    expect(bodies[0].body).toMatchObject({ client: "web" });
  });

  it("passe par Google en tant que site", async () => {
    const bodies = capture();
    await googleSignIn("https://example.test/api", "jeton-google");

    expect(bodies[0].url).toBe("https://example.test/api/v1/auth/google");
    expect(bodies[0].body).toMatchObject({ id_token: "jeton-google", client: "web" });
  });
});
