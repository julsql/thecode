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
    // Le carnet vit dans le stockage local : sans ce nettoyage, une entree
    // enregistree par un test ferait generer les suivants depuis cette entree.
    localStorage.clear();
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

  // La v2 met plusieurs centaines de millisecondes : basculer en v1 pendant
  // qu'elle calcule laissait la v2, en retard, ecraser le mot de passe v1
  // deja affiche. L'ecran montrait alors un mot de passe qui ne correspondait
  // pas au mode affiche.
  it("ne laisse pas la v2 en retard ecraser la v1 demandee entre-temps", async () => {
    const canonical = vectors.v1.cases.find((c: any) => c.id === "canonical");

    await wrapper.find("#id_site").setValue(canonical.site);
    await wrapper.find("#id_clef").setValue(canonical.master);
    // Sans attendre la fin de la v2 : c'est tout l'interet du test.
    const v1Button = wrapper.findAll("button").find((b) => b.text().includes("v1"));
    await v1Button!.trigger("click");

    await vi.waitFor(() => expect(generated(wrapper)).toBe(canonical.expected), {
      timeout: 15000,
    });
    // Laisse la v2 en vol se terminer : elle ne doit plus rien ecrire.
    await new Promise((r) => setTimeout(r, 2000));
    expect(generated(wrapper)).toBe(canonical.expected);
  }, 25000);

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

  it("ignore une entree v1 du stockage et ne propose plus de migration", async () => {
    const { emptyVault, newEntry, VAULT_STORAGE_KEY } = await import("@/vault");

    // Ecrit a la main : le carnet refuse d'enregistrer une entree v1.
    const vault = emptyVault();
    vault.entries.push({ ...newEntry("google.com", { domains: ["google.com"] }), v: 1 });
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));

    const wrapper = await mountGenerate();
    await wrapper.find("#id_site").setValue("google.com");
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).not.toContain("Passer en v2");
    expect(wrapper.text()).not.toContain("Renouveler");
    expect(wrapper.text()).toContain("Enregistrer ce site");
  });

  it("propose de renouveler une entree v2", async () => {
    const { saveVault, emptyVault, newEntry } = await import("@/vault");

    const vault = emptyVault();
    vault.entries.push(newEntry("google.com", { domains: ["google.com"] }));
    saveVault(vault);

    const wrapper = await mountGenerate();
    await wrapper.find("#id_site").setValue("google.com");
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Renouveler");
    expect(wrapper.text()).not.toContain("Passer en v2");
  });

  /**
   * Le renouvellement passe par le compteur, qui fait partie de l'offre
   * complète. L'offre connue vit avec la session : la génération se fait hors
   * ligne, il n'y a personne à interroger au moment du clic.
   */
  function signInAs(plan: string) {
    localStorage.setItem(
      "thecode.session",
      JSON.stringify({
        endpoint: "https://thecode-api.julsql.fr",
        accessToken: "jeton",
        refreshToken: "renouvellement",
        plan,
      }),
    );
  }

  it("montre les deux mots de passe avant d'ecrire quoi que ce soit", async () => {
    const { saveVault, emptyVault, newEntry, loadVault, findAllByDomain } = await import("@/vault");

    const vault = emptyVault();
    vault.entries.push(newEntry("google.com", { domains: ["google.com"] }));
    saveVault(vault);
    signInAs("pro");

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

  it("refuse le renouvellement a l'offre gratuite", async () => {
    const { saveVault, emptyVault, newEntry } = await import("@/vault");

    const vault = emptyVault();
    vault.entries.push(newEntry("google.com", { domains: ["google.com"] }));
    saveVault(vault);
    // Sans compte, donc offre gratuite : le compteur est ce qui permet de
    // changer un mot de passe sans changer sa clef, et c'est ce qui se paie.
    const wrapper = await mountGenerate();

    await wrapper.find("#id_clef").setValue("clef");
    await wrapper.find("#id_site").setValue("google.com");
    await wrapper.vm.$nextTick();

    // Le bouton reste cliquable : un bouton éteint n'explique rien et ne
    // propose rien. C'est le refus qui dit ce que l'offre complète apporte.
    const renew = wrapper.findAll("button").find((b) => b.text() === "Renouveler");
    expect(renew!.attributes("disabled")).toBeUndefined();

    await renew!.trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("offre complète");
    // Et rien n'a été calculé ni écrit.
    expect(wrapper.text()).not.toContain("Nouveau mot de passe");
  }, 20000);

  it("enregistre en v2 meme depuis l'ecran regle en v1", async () => {
    const wrapper = await mountGenerate();

    await wrapper.find("#id_site").setValue("google.com");
    const v1Button = wrapper.findAll("button").find((b) => b.text() === "v1");
    await v1Button!.trigger("click");

    const button = wrapper.findAll("button").find((b) => b.text().includes("Enregistrer"));
    await button!.trigger("click");
    await wrapper.vm.$nextTick();

    // La v1 ne vit qu'en generation ponctuelle, hors carnet.
    const { loadVault, findAllByDomain } = await import("@/vault");
    expect(findAllByDomain(loadVault(), "google.com")[0]?.v).toBe(2);
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

describe("identifiant", () => {
  beforeEach(() => localStorage.clear());

  const loginValue = (w: { find: (s: string) => any }) =>
    (w.find("#id_login").element as HTMLInputElement).value;

  it("fait entrer l'identifiant dans la derivation v2", async () => {
    const withLogin = vectors.v2.cases.find((c: any) => c.id === "v2-with-login");
    const wrapper = await mountGenerate();

    await wrapper.find("#id_site").setValue(withLogin.site);
    await wrapper.find("#id_login").setValue(withLogin.login);
    await wrapper.find("#id_clef").setValue(withLogin.master);

    await vi.waitFor(() => expect(generated(wrapper)).toBe(withLogin.expected), {
      timeout: 15000,
    });
  }, 20000);

  it("ignore les espaces autour de l'identifiant", async () => {
    const withLogin = vectors.v2.cases.find((c: any) => c.id === "v2-with-login");
    const wrapper = await mountGenerate();

    await wrapper.find("#id_site").setValue(withLogin.site);
    await wrapper.find("#id_login").setValue(`  ${withLogin.login} `);
    await wrapper.find("#id_clef").setValue(withLogin.master);

    await vi.waitFor(() => expect(generated(wrapper)).toBe(withLogin.expected), {
      timeout: 15000,
    });
  }, 20000);

  it("est ignore en v1, et le dit", async () => {
    const canonical = vectors.v1.cases.find((c: any) => c.id === "canonical");
    const wrapper = await mountGenerate();
    expect(wrapper.text()).not.toContain("ignore l'identifiant");

    await wrapper.find("#id_site").setValue(canonical.site);
    await wrapper.find("#id_login").setValue("moi");
    await wrapper.find("#id_clef").setValue(canonical.master);
    const v1Button = wrapper.findAll("button").find((b) => b.text() === "v1");
    await v1Button!.trigger("click");

    expect(wrapper.text()).toContain("L'algorithme v1 ignore l'identifiant.");
    await vi.waitFor(() => expect(generated(wrapper)).toBe(canonical.expected), {
      timeout: 15000,
    });
  }, 20000);

  it("se traduit en anglais", async () => {
    const router = makeRouter();
    router.push("/en");
    await router.isReady();
    const wrapper = mount(Generate, { global: { plugins: [router] } });
    await wrapper.vm.$nextTick();

    expect(wrapper.find("label[for='id_login']").text()).toBe("Login");
  });

  it("reprend l'identifiant connu du carnet, puis l'oublie en changeant de site", async () => {
    const { saveVault, emptyVault, newEntry } = await import("@/vault");
    const vault = emptyVault();
    vault.entries.push(newEntry("google.com", { login: "moi" }));
    saveVault(vault);

    const wrapper = await mountGenerate();
    await wrapper.find("#id_site").setValue("google.com");
    expect(loginValue(wrapper)).toBe("moi");
    expect(wrapper.text()).toContain("Mettre à jour l'entrée");

    await wrapper.find("#id_site").setValue("github.com");
    expect(loginValue(wrapper)).toBe("");
  });

  it("garde l'identifiant saisi par l'utilisateur", async () => {
    const { saveVault, emptyVault, newEntry } = await import("@/vault");
    const vault = emptyVault();
    vault.entries.push(newEntry("google.com", { login: "moi" }));
    saveVault(vault);

    const wrapper = await mountGenerate();
    await wrapper.find("#id_login").setValue("pro");
    await wrapper.find("#id_site").setValue("google.com");

    expect(loginValue(wrapper)).toBe("pro");
    expect(wrapper.text()).toContain("Enregistrer ce site");
  });

  it("met a jour l'entree du meme identifiant sans toucher a siteKey", async () => {
    const { saveVault, emptyVault, newEntry, loadVault } = await import("@/vault");
    const vault = emptyVault();
    const entry = newEntry("google.com", { domains: ["google.com"], login: "moi" });
    entry.siteKey = "accounts.google.com";
    vault.entries.push(entry);
    saveVault(vault);

    const wrapper = await mountGenerate();
    await wrapper.find("#id_site").setValue("google.com");
    await wrapper.find("#id_longueur").setValue("16");
    const button = wrapper.findAll("button").find((b) => b.text().includes("Mettre à jour"));
    await button!.trigger("click");

    const entries = loadVault().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].length).toBe(16);
    expect(entries[0].siteKey).toBe("accounts.google.com");
  });

  it("cree une nouvelle entree v2 pour un autre identifiant", async () => {
    const { saveVault, emptyVault, newEntry, loadVault, findAllByDomain } = await import("@/vault");
    const vault = emptyVault();
    vault.entries.push(newEntry("google.com", { login: "moi" }));
    saveVault(vault);

    const wrapper = await mountGenerate();
    await wrapper.find("#id_site").setValue("google.com");
    await wrapper.find("#id_login").setValue("pro");
    const button = wrapper.findAll("button").find((b) => b.text().includes("Enregistrer"));
    await button!.trigger("click");

    const entries = findAllByDomain(loadVault(), "google.com");
    expect(entries.map((e) => e.login).sort()).toStrictEqual(["moi", "pro"]);
    expect(entries.every((e) => e.v === 2)).toBe(true);
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

  it("s'ouvre en fenêtre modale", async () => {
    const wrapper = await mountGenerate();

    expect(wrapper.find(".modal-backdrop").exists()).toBe(true);
    expect(wrapper.text()).toContain("Nouvel algorithme");
  });

  it("se traduit en anglais et renvoie vers le site pour la v1", async () => {
    const router = makeRouter();
    router.push("/en");
    await router.isReady();
    const wrapper = mount(Generate, { global: { plugins: [router] } });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("New algorithm");
    expect(wrapper.text()).toContain("generate the password in v1 from the website");
  });

  it("revient la prochaine fois si on ferme sans cocher", async () => {
    const wrapper = await mountGenerate();

    const close = wrapper.findAll("button").find((b) => b.text() === "Fermer");
    await close!.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".modal-backdrop").exists()).toBe(false);

    // Une annonce qu'on n'a pas eu le temps de lire ne doit pas disparaître
    // pour toujours.
    const again = await mountGenerate();
    expect(again.find(".modal-backdrop").exists()).toBe(true);
  });

  it("ne revient plus si on coche avant de fermer", async () => {
    const wrapper = await mountGenerate();

    await wrapper.find(".modal-check input").setValue(true);
    const close = wrapper.findAll("button").find((b) => b.text() === "Fermer");
    await close!.trigger("click");
    await wrapper.vm.$nextTick();

    const again = await mountGenerate();
    expect(again.find(".modal-backdrop").exists()).toBe(false);
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
      expect(wrapper.find(".modal-backdrop").exists()).toBe(true);
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});
