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
    const canonical = vectors.v1.cases.find((c: any) => c.id === "canonical");

    await wrapper.find("#id_site").setValue(canonical.site);
    await wrapper.find("#id_clef").setValue(canonical.master);
    await wrapper.vm.$nextTick();

    await vi.waitFor(() => expect(generated(wrapper)).toBe(canonical.expected));
  });

  it("regenere quand la longueur change", async () => {
    const short = vectors.v1.cases.find((c: any) => c.id === "len-16");

    await wrapper.find("#id_site").setValue(short.site);
    await wrapper.find("#id_clef").setValue(short.master);
    await wrapper.find("#id_longueur").setValue(String(short.length));
    await wrapper.vm.$nextTick();

    await vi.waitFor(() => expect(generated(wrapper)).toBe(short.expected));
  });

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
    expect(wrapper.text()).toContain("Connecter");
    expect(wrapper.text()).not.toContain("Déconnecter");
  });

  it("refuse de synchroniser sans clef maîtresse", async () => {
    const { saveSession, clearSession } = await import("@/sync");
    saveSession({ endpoint: "https://x", accessToken: "a", refreshToken: "r" });

    const wrapper = await mountGenerate();
    const button = wrapper.findAll("button").find((b) => b.text() === "Synchroniser");
    await button!.trigger("click");
    await wrapper.vm.$nextTick();

    // Le carnet est chiffré avec une clef dérivée de la clef maîtresse :
    // sans elle, il n'y a rien à chiffrer ni à relire.
    expect(wrapper.text()).toContain("clef maîtresse");

    clearSession();
  });
});
