/**
 * Tests de composant de la page de generation.
 *
 * Complementent les vecteurs de conformite : ceux-ci verifient l'algorithme,
 * ceux-la verifient que l'interface le pilote correctement — c'est la couche
 * ou une erreur de cablage passerait inapercue (mauvais parametre transmis,
 * mot de passe affiche en clair, champ non reactif).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory, type Router } from "vue-router";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Generate from "@/pages/Generate.vue";

// Le resultat vit dans un <input readonly> : wrapper.text() ne voit pas les
// valeurs de champ, il faut lire l'element.
const generated = (w: { find: (s: string) => any }) =>
  (w.find("#password").element as HTMLInputElement).value;

const vectors = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "test-vectors.json"), "utf8"),
);

// useI18n() lit la langue depuis la route : il faut donc un vrai router.
function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:lang?", component: Generate }],
  });
}

async function mountGenerate() {
  const router = makeRouter();
  router.push("/fr");
  await router.isReady();
  const wrapper = mount(Generate, { global: { plugins: [router] } });
  await wrapper.vm.$nextTick();
  return wrapper;
}

describe("page de generation", () => {
  let wrapper: Awaited<ReturnType<typeof mountGenerate>>;

  beforeEach(async () => {
    wrapper = await mountGenerate();
  });

  it("expose les champs attendus", () => {
    expect(wrapper.find("#id_clef").exists()).toBe(true);
    expect(wrapper.find("#id_site").exists()).toBe(true);
    expect(wrapper.find("#id_longueur").exists()).toBe(true);
  });

  it("masque la clef par defaut", () => {
    expect(wrapper.find("#id_clef").attributes("type")).toBe("password");
  });

  it("genere le mot de passe du vecteur partage a partir des champs", async () => {
    // v2 par defaut desormais : c'est ce vecteur-la que l'ecran doit rendre.
    const canonical = vectors.v2.cases.find((c: any) => c.id === "v2-canonical");

    await wrapper.find("#id_site").setValue(canonical.site);
    await wrapper.find("#id_clef").setValue(canonical.master);
    await wrapper.vm.$nextTick();

    await vi.waitFor(() => expect(generated(wrapper)).toBe(canonical.expected), {
      timeout: 15000,
    });
  }, 20000);

  it("rend l'ancien mot de passe quand on demande la v1", async () => {
    // Le secours pour un site dont le mot de passe n'a pas encore ete change.
    const canonical = vectors.v1.cases.find((c: any) => c.id === "canonical");

    await wrapper.find("#id_site").setValue(canonical.site);
    await wrapper.find("#id_clef").setValue(canonical.master);
    const v1Button = wrapper.findAll("button").find((b) => b.text().includes("v1"));
    await v1Button!.trigger("click");
    await wrapper.vm.$nextTick();

    await vi.waitFor(() => expect(generated(wrapper)).toBe(canonical.expected), {
      timeout: 15000,
    });
  }, 20000);

  it("regenere quand la longueur change", async () => {
    const short = vectors.v2.cases.find((c: any) => c.id === "v2-len-min");

    await wrapper.find("#id_site").setValue(short.site);
    await wrapper.find("#id_clef").setValue(short.master);
    await wrapper.find("#id_longueur").setValue(String(short.length));
    await wrapper.vm.$nextTick();

    await vi.waitFor(() => expect(generated(wrapper)).toBe(short.expected), { timeout: 15000 });
  }, 20000);

  // Sans clef, le mot de passe ne dependrait que du site : identique pour tous
  // les utilisateurs, et calculable par quiconque connait le site. Ce test
  // verrouille le refus.
  it("ne genere rien tant que la clef est vide", async () => {
    await wrapper.find("#id_site").setValue("google.com");
    await wrapper.vm.$nextTick();

    await vi.waitFor(() => expect(generated(wrapper)).toBe(""));
  });
});

describe("carnet et empreinte", () => {
  // localStorage survit d'un test a l'autre : sans ce nettoyage, une entree
  // laissee par un test change le libelle du bouton d'un autre.
  beforeEach(() => localStorage.clear());

  it("affiche l'empreinte des que la clef est saisie", async () => {
    const wrapper = await mountGenerate();
    expect(wrapper.text()).not.toContain("Empreinte");

    await wrapper.find("#id_clef").setValue("clef");
    await wrapper.vm.$nextTick();

    // Meme valeur que le CLI et l'extension : un indicateur qui differe
    // selon l'appareil est un indicateur auquel on ne se fie plus.
    await vi.waitFor(() => expect(wrapper.text()).toContain("KG8"), { timeout: 5000 });
  });

  it("propose d'enregistrer le site dans le carnet", async () => {
    const wrapper = await mountGenerate();
    expect(wrapper.text()).toContain("Enregistrer ce site");
  });

  it("propose de migrer une entree v1 et de renouveler une v2", async () => {
    const { saveVault, emptyVault, newEntry } = await import("@/vault");

    const vault = emptyVault();
    // v1 explicite : les entrees naissent desormais en v2.
    vault.entries.push(newEntry("google.com", { domains: ["google.com"], v: 1 }));
    saveVault(vault);

    const wrapper = await mountGenerate();
    await wrapper.find("#id_site").setValue("google.com");
    await wrapper.vm.$nextTick();

    // Une entree v1 n'a rien a renouveler : le compteur n'entre pas dans sa
    // derivation. On ne propose donc que la migration.
    expect(wrapper.text()).toContain("Passer en v2");
    expect(wrapper.text()).not.toContain("Renouveler");
  });

  it("montre les deux mots de passe avant d'ecrire quoi que ce soit", async () => {
    const { saveVault, emptyVault, newEntry, loadVault, findAllByDomain } = await import("@/vault");

    const vault = emptyVault();
    vault.entries.push(newEntry("google.com", { domains: ["google.com"], v: 2 }));
    saveVault(vault);

    const wrapper = await mountGenerate();
    await wrapper.find("#id_clef").setValue("clef");
    await wrapper.find("#id_site").setValue("google.com");
    await wrapper.vm.$nextTick();

    const renew = wrapper.findAll("button").find((b) => b.text() === "Renouveler");
    await renew!.trigger("click");

    await vi.waitFor(() => expect(wrapper.text()).toContain("Nouveau"), { timeout: 10000 });
    expect(wrapper.text()).toContain("Mot de passe actuel");

    // Rien n'est ecrit tant que ce n'est pas confirme : l'ancien mot de passe
    // est encore celui du site.
    expect(findAllByDomain(loadVault(), "google.com")[0].counter).toBe(1);

    const confirm = wrapper.findAll("button").find((b) => b.text() === "Confirmer");
    await confirm!.trigger("click");
    await wrapper.vm.$nextTick();

    expect(findAllByDomain(loadVault(), "google.com")[0].counter).toBe(2);
  });

  it("enregistre les reglages et les retrouve", async () => {
    const wrapper = await mountGenerate();

    await wrapper.find("#id_site").setValue("google.com");
    await wrapper.find("#id_longueur").setValue("16");
    await wrapper.vm.$nextTick();

    const button = wrapper.findAll("button").find((b) => b.text().includes("Enregistrer"));
    await button!.trigger("click");
    await wrapper.vm.$nextTick();

    // C'etait le probleme : rien ne memorisait qu'un site avait ete regle
    // autrement que par defaut.
    const { loadVault, findAllByDomain } = await import("@/vault");
    const entry = findAllByDomain(loadVault(), "google.com")[0];
    expect(entry?.length).toBe(16);
  });
});

describe("synchronisation", () => {
  it("propose de se connecter, pas de synchroniser", async () => {
    const wrapper = await mountGenerate();
    // Sans session, proposer « Synchroniser » donnerait un bouton qui échoue.
    expect(wrapper.text()).toContain("Se connecter");
    expect(wrapper.text()).not.toContain("Déconnecter");
  });

  it("refuse de synchroniser sans clef maîtresse", async () => {
    const { saveSession, clearSession } = await import("@/sync");
    saveSession({ endpoint: "https://x", accessToken: "a", refreshToken: "r" });

    const wrapper = await mountGenerate();
    const button = wrapper
      .findAll("button")
      .find((b) => b.text().startsWith("Synchroniser maintenant"));
    await button!.trigger("click");
    await wrapper.vm.$nextTick();

    // Le carnet est chiffré avec une clef dérivée de la clef maîtresse :
    // sans elle, il n'y a rien à chiffrer ni à relire.
    expect(wrapper.text()).toContain("clef maîtresse");

    clearSession();
  });
});

describe("transfert du carnet", () => {
  beforeEach(async () => {
    localStorage.clear();
    // jsdom fournit un Blob sans .stream(), dont depend CompressionStream.
    // Celui de node a la meme API : c'est l'environnement de test qui est
    // incomplet, pas le code.
    vi.stubGlobal("Blob", (await import("node:buffer")).Blob);
  });

  it("refuse d'afficher un QR sans clef", async () => {
    const wrapper = await mountGenerate();

    const button = wrapper.findAll("button").find((b) => b.text().includes("QR"));
    await button!.trigger("click");
    await wrapper.vm.$nextTick();

    // Sans clef, il n'y a pas de quoi chiffrer : mieux vaut le dire que
    // d'afficher un code que personne ne pourra ouvrir.
    expect(wrapper.text()).toContain("clef");
  });

  it("refuse d'afficher un QR d'un carnet vide", async () => {
    const wrapper = await mountGenerate();
    await wrapper.find("#id_clef").setValue("clef");

    const button = wrapper.findAll("button").find((b) => b.text().includes("QR"));
    await button!.trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("vide");
  });

  it("affiche un QR du carnet chiffré", { timeout: 20000 }, async () => {
    const { saveVault, emptyVault, newEntry } = await import("@/vault");
    const vault = emptyVault();
    vault.entries.push(newEntry("google.com", { domains: ["google.com"] }));
    saveVault(vault);

    const wrapper = await mountGenerate();
    await wrapper.find("#id_clef").setValue("clef");

    const button = wrapper.findAll("button").find((b) => b.text().includes("QR"));
    await button!.trigger("click");

    await vi.waitFor(() => expect(wrapper.findAll(".qr-row").length).toBeGreaterThan(20), {
      timeout: 10000,
    });
    // Carré : un QR non carré signalerait une matrice mal construite.
    const rows = wrapper.findAll(".qr-row");
    expect(rows[0].findAll("span").length).toBe(rows.length);
  });
});

describe("annonce du passage à la v2", () => {
  beforeEach(() => localStorage.clear());

  it("s'affiche tant qu'elle n'a pas été lue", async () => {
    const wrapper = await mountGenerate();
    expect(wrapper.find(".notice").exists()).toBe(true);
    expect(wrapper.text()).toContain("v2");
  });

  it("ne revient plus une fois fermée", async () => {
    const wrapper = await mountGenerate();

    const close = wrapper.findAll("button").find((b) => b.text() === "J'ai compris");
    await close!.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".notice").exists()).toBe(false);

    // Elle ne concerne que la version qui l'apporte : la reposer à chaque
    // visite serait du harcèlement.
    const again = await mountGenerate();
    expect(again.find(".notice").exists()).toBe(false);
  });

  it("s'affiche quand même si le stockage est indisponible", async () => {
    // Navigation privée, stockage bloqué : la page doit s'afficher, et
    // l'annonce avec — mieux vaut la revoir qu'une page cassée.
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("stockage bloqué");
    };

    try {
      const wrapper = await mountGenerate();
      expect(wrapper.find(".notice").exists()).toBe(true);
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});
