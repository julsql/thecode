/**
 * Carnet : fusion verifiee contre les cas partages.
 *
 * La regle doit etre identique sur les cinq implementations : deux appareils
 * qui fusionnent les memes carnets doivent aboutir au meme resultat, sinon ils
 * repartent en divergence a la synchronisation suivante.
 *
 * Fichier synchronise depuis shared/ ; ne jamais l'editer directement.
 */
const { webcrypto } = require("node:crypto");
if (!global.crypto) global.crypto = webcrypto;

const { emptyVault, newEntry, findByDomain, findAllByDomain, mergeVaults } = require("../vault");
const spec = require("./merge-cases.json");

const normalise = (v) => [...v.entries].sort((a, b) => (a.id < b.id ? -1 : 1));

describe("fusion (cas partages)", () => {
  describe.each(spec.cases.map((c) => [c.id, c]))("%s", (_id, c) => {
    it("produit le carnet attendu", () => {
      const { vault, conflicts } = mergeVaults(c.left, c.right);
      expect(normalise(vault)).toStrictEqual(normalise(c.expected));
      expect([...new Set(conflicts.map((x) => x.kind))].sort()).toStrictEqual(
        [...new Set(c.conflicts)].sort(),
      );
    });

    it("est commutative", () => {
      // siteKey divergent est volontairement asymetrique : on garde celui de
      // gauche plutot que de trancher a la place de l'utilisateur.
      if (c.conflicts.includes("sitekey-divergent")) return;
      const a = mergeVaults(c.left, c.right).vault;
      const b = mergeVaults(c.right, c.left).vault;
      expect(normalise(a)).toStrictEqual(normalise(b));
    });

    it("est idempotente", () => {
      const once = mergeVaults(c.left, c.right).vault;
      const twice = mergeVaults(once, c.right).vault;
      expect(normalise(twice)).toStrictEqual(normalise(once));
    });
  });
});

describe("le carnet repond aux trois problemes d'origine", () => {
  it("un compte, plusieurs domaines", () => {
    const v = emptyVault();
    v.entries.push(newEntry("google.com", { domains: ["google.com", "google.fr", "youtube.com"] }));
    for (const d of ["google.com", "google.fr", "youtube.com"]) {
      expect(findByDomain(v, d).siteKey).toBe("google.com");
    }
  });

  it("plusieurs comptes, un site", () => {
    const v = emptyVault();
    v.entries.push(newEntry("google.com", { domains: ["google.com"], label: "perso" }));
    v.entries.push(newEntry("google.com#pro", { domains: ["google.com"], label: "pro" }));
    const found = findAllByDomain(v, "google.com");
    expect(found).toHaveLength(2);
    expect(found.map((e) => e.siteKey).sort()).toStrictEqual(["google.com", "google.com#pro"]);
  });

  it("les parametres sont par entree", () => {
    const v = emptyVault();
    v.entries.push(newEntry("a.com", { length: 32 }));
    v.entries.push(newEntry("b.com", { length: 12 }));
    expect(findByDomain(v, "a.com").length).toBe(32);
    expect(findByDomain(v, "b.com").length).toBe(12);
  });

  it("une entree supprimee ne remonte plus", () => {
    const v = emptyVault();
    const e = newEntry("google.com");
    e.deleted = true;
    v.entries.push(e);
    expect(findByDomain(v, "google.com")).toBeNull();
  });
});

describe("le carnet ne contient aucun secret", () => {
  it("n'expose ni mot de passe ni clef", () => {
    const e = newEntry("google.com", { login: "moi@example.com" });
    const keys = Object.keys(e);
    expect(keys).not.toContain("password");
    expect(keys).not.toContain("encodingKey");
    expect(JSON.stringify(e)).not.toMatch(/motdepasse|password|secret/i);
  });
});
