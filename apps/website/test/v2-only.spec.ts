/**
 * Le carnet n'accepte que la v2.
 *
 * Chaque chemin de lecture (stockage local, fusion, synchronisation) est
 * vérifié contre le vecteur partagé : après lecture de `vault`, seules les
 * entrées de `expectedIds` restent. L'import chiffré est couvert dans
 * transfer-vault.spec.ts, qui tourne sous node.
 *
 * Spécification : shared/spec/vault-merge.md, « Uniquement des entrées v2 ».
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  VAULT_STORAGE_KEY,
  emptyVault,
  isVaultEntryV2,
  keepV2Only,
  loadVault,
  mergeVaults,
  newEntry,
  saveVault,
  type Vault,
} from "@/vault";
import { deriveTransferKey, b64e } from "@/transfer";
import { syncVault } from "@/sync";

const fixture = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "v2-only.json"), "utf8"),
) as { vault: Vault; expectedIds: string[] };

const ids = (v: Vault) => v.entries.map((e) => e.id).sort();
const expected = [...fixture.expectedIds].sort();
const copy = (): Vault => structuredClone(fixture.vault);

describe("carnet v2 uniquement (vecteur partagé)", () => {
  beforeEach(() => localStorage.clear());

  it("reconnaît une entrée v2 et elle seule", () => {
    expect(fixture.vault.entries.map(isVaultEntryV2)).toStrictEqual([false, true, false]);
    expect(isVaultEntryV2(null)).toBe(false);
  });

  it("écarte les entrées v ≠ 2", () => {
    expect(ids(keepV2Only(copy()))).toStrictEqual(expected);
  });

  it("au chargement du carnet local", () => {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(fixture.vault));
    expect(ids(loadVault())).toStrictEqual(expected);
  });

  it("refuse d'écrire une entrée v ≠ 2", () => {
    saveVault(copy());
    const stored = JSON.parse(localStorage.getItem(VAULT_STORAGE_KEY)!) as Vault;
    expect(ids(stored)).toStrictEqual(expected);
  });

  it("à la fusion, de quelque côté que vienne le carnet", () => {
    expect(ids(mergeVaults(emptyVault(), copy()).vault)).toStrictEqual(expected);
    expect(ids(mergeVaults(copy(), emptyVault()).vault)).toStrictEqual(expected);
  });

  it("crée toujours une entrée v2", () => {
    expect(newEntry("google.com").v).toBe(2);
  });
});

describe("carnet v2 uniquement à la synchronisation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("écarte les entrées v ≠ 2 venues du serveur", async () => {
    const key = await deriveTransferKey("clef");
    const rows = await Promise.all(
      fixture.vault.entries.map(async (entry) => {
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

    expect(ids(result.vault)).toStrictEqual(expected);
    // Et rien d'autre n'est renvoyé au serveur.
    const sent = JSON.parse(pushed[0]).entries.map((r: { entry_id: string }) => r.entry_id);
    expect(sent.sort()).toStrictEqual(expected);
  }, 20000);
});
