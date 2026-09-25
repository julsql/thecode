/**
 * Carnet : fusion verifiee contre les cas partages.
 * Fichier synchronise depuis shared/ ; ne jamais l'editer directement.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  emptyVault,
  newEntry,
  findByDomain,
  findAllByDomain,
  mergeVaults,
  selectForPush,
  type Vault,
} from "@/vault";

const spec = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "merge-cases.json"), "utf8"),
);

const selection = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "sync-selection.json"), "utf8"),
);

const normalise = (v: Vault) => [...v.entries].sort((a, b) => (a.id < b.id ? -1 : 1));

describe("fusion (cas partages)", () => {
  it.each(spec.cases.map((c: any) => [c.id, c]))("%s", (_id: string, c: any) => {
    const { vault, conflicts } = mergeVaults(c.left, c.right);
    expect(normalise(vault)).toStrictEqual(normalise(c.expected));
    expect([...new Set(conflicts.map((x) => x.kind))].sort()).toStrictEqual(
      [...new Set(c.conflicts as string[])].sort(),
    );
  });

  it.each(spec.cases.map((c: any) => [c.id, c]))("%s — commutative", (_id: string, c: any) => {
    // siteKey divergent est volontairement asymetrique : on garde celui de
    // gauche plutot que de trancher a la place de l'utilisateur.
    if (c.conflicts.includes("sitekey-divergent")) return;
    expect(normalise(mergeVaults(c.left, c.right).vault)).toStrictEqual(
      normalise(mergeVaults(c.right, c.left).vault),
    );
  });

  it.each(spec.cases.map((c: any) => [c.id, c]))("%s — idempotente", (_id: string, c: any) => {
    const once = mergeVaults(c.left, c.right).vault;
    expect(normalise(mergeVaults(once, c.right).vault)).toStrictEqual(normalise(once));
  });
});

describe("synchronisation partielle (cas partages)", () => {
  it.each(selection.cases.map((c: any) => [c.id, c]))("%s", (_id: string, c: any) => {
    const { push, localOnly } = selectForPush(c.vault, c.remoteIds, c.maxEntries);
    expect(push.map((e) => e.id)).toStrictEqual(c.push);
    expect(localOnly.map((e) => e.id)).toStrictEqual(c.localOnly);
  });
});

describe("date de creation", () => {
  it("est posee a la creation", () => {
    const entry = newEntry("google.com");
    expect(entry.createdAt).toBe(entry.updatedAt);
  });
});

describe("les trois problemes d'origine", () => {
  it("un compte, plusieurs domaines", () => {
    const v = emptyVault();
    v.entries.push(newEntry("google.com", { domains: ["google.com", "google.fr", "youtube.com"] }));
    for (const d of ["google.com", "google.fr", "youtube.com"]) {
      expect(findByDomain(v, d)?.siteKey).toBe("google.com");
    }
  });

  it("plusieurs comptes, un site", () => {
    const v = emptyVault();
    v.entries.push(newEntry("google.com", { domains: ["google.com"] }));
    v.entries.push(newEntry("google.com#pro", { domains: ["google.com"] }));
    expect(findAllByDomain(v, "google.com")).toHaveLength(2);
  });

  it("les parametres sont par entree", () => {
    const v = emptyVault();
    v.entries.push(newEntry("a.com", { length: 32 }));
    v.entries.push(newEntry("b.com", { length: 12 }));
    expect(findByDomain(v, "a.com")?.length).toBe(32);
    expect(findByDomain(v, "b.com")?.length).toBe(12);
  });
});

describe("robustesse du stockage", () => {
  it("ne contient aucun secret", () => {
    const e = newEntry("google.com", { login: "moi@example.com" });
    expect(Object.keys(e)).not.toContain("password");
    expect(JSON.stringify(e)).not.toMatch(/password|secret/i);
  });
});
