/**
 * Une entrée ne porte pas de version : un `v` résiduel est ignoré.
 *
 * Toute entrée du carnet dérive en v2. Un champ `v` lu (stockage local,
 * synchronisation, fusion) est toléré, retiré, et jamais réécrit ; l'entrée
 * est gardée. L'import chiffré est couvert dans transfer-vault.spec.ts, qui
 * tourne sous node.
 *
 * Spécification : shared/spec/vault-merge.md, « Pas de version par entrée ».
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  VAULT_STORAGE_KEY,
  dropVersion,
  emptyVault,
  loadVault,
  mergeVaults,
  newEntry,
  saveVault,
  stripVersions,
  type Vault,
  type VaultEntry,
} from "@/vault";
import { b64d, b64e, deriveTransferKey } from "@/transfer";
import { syncVault } from "@/sync";
import { passwordForEntry } from "@/renew";
import { generatePasswordV2 } from "@/coreV2";
import { generatePassword } from "@/utils";

function strayEntry(v: unknown = 1): VaultEntry {
  return {
    ...newEntry("google.com", { domains: ["google.com"], login: "moi" }),
    v,
  } as VaultEntry;
}

function strayVault(v: unknown = 1): Vault {
  const entry = strayEntry(v);
  return { schema: 1, updatedAt: entry.updatedAt, entries: [entry] };
}

const hasV = (vault: { entries: object[] }) => vault.entries.some((e) => "v" in e);

describe("entrée sans version", () => {
  beforeEach(() => localStorage.clear());

  it("une entrée naît sans v", () => {
    expect(newEntry("site.fr")).not.toHaveProperty("v");
  });

  it("dropVersion retire v sans toucher au reste", () => {
    const entry = newEntry("site.fr");
    expect(dropVersion({ ...entry, v: 3 })).toStrictEqual(entry);
    expect(dropVersion(null)).toBeNull();
    expect(stripVersions(strayVault()).entries).toHaveLength(1);
  });

  it.each([1, 2, 3])("garde l'entrée et retire v = %i au chargement", (v) => {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(strayVault(v)));

    const loaded = loadVault();

    expect(loaded.entries).toHaveLength(1);
    expect(hasV(loaded)).toBe(false);
  });

  it("n'écrit jamais v", () => {
    saveVault(strayVault());

    const stored = JSON.parse(localStorage.getItem(VAULT_STORAGE_KEY)!) as Vault;
    expect(stored.entries).toHaveLength(1);
    expect(hasV(stored)).toBe(false);
  });

  it("retire v à la fusion, de quelque côté que vienne le carnet", () => {
    for (const merged of [
      mergeVaults(emptyVault(), strayVault()).vault,
      mergeVaults(strayVault(), emptyVault()).vault,
    ]) {
      expect(merged.entries).toHaveLength(1);
      expect(hasV(merged)).toBe(false);
    }
  });
});

describe("dérivation d'une entrée portant un v résiduel", () => {
  it("dérive toujours en v2", async () => {
    const entry = strayEntry(1);

    expect(await passwordForEntry(entry, "clef")).toBe(
      await generatePasswordV2("google.com", "clef", entry.length, {
        login: "moi",
        counter: 1,
      }),
    );
  });

  it("ne sort la v1 que sur demande explicite", async () => {
    const entry = strayEntry(2);

    expect(await passwordForEntry(entry, "clef", entry.counter, 1)).toBe(
      await generatePassword("google.com", "clef", entry.length, true, true, true, true),
    );
  });
});

describe("entrée portant un v résiduel à la synchronisation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("garde l'entrée venue du serveur et ne repousse pas v", async () => {
    const key = await deriveTransferKey("clef");
    const rows = await Promise.all(
      strayVault().entries.map(async (entry) => {
        const nonce = crypto.getRandomValues(new Uint8Array(12));
        const plain = new TextEncoder().encode(JSON.stringify(entry));
        const blob = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plain);
        return { entry_id: entry.id, nonce: b64e(nonce), blob: b64e(blob), deleted: false };
      }),
    );
    const pushed: string[] = [];
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => {
      if (init?.body) pushed.push(init.body as string);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            init?.body ? { revision: 1, accepted: 1 } : { revision: 0, entries: rows },
          ),
      } as Response);
    });

    const result = await syncVault(emptyVault(), "clef", {
      endpoint: "https://example.test/api",
      accessToken: "a",
      refreshToken: "r",
    });

    expect(result.vault.entries).toHaveLength(1);
    expect(hasV(result.vault)).toBe(false);
    const sent = await Promise.all(
      JSON.parse(pushed[0]).entries.map(async (row: { nonce: string; blob: string }) => {
        const plain = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: b64d(row.nonce) },
          key,
          b64d(row.blob),
        );
        return JSON.parse(new TextDecoder().decode(plain)) as object;
      }),
    );
    expect(sent).toHaveLength(1);
    expect(hasV({ entries: sent })).toBe(false);
  }, 20000);
});
