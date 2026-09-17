/**
 * Tests de composant de la page de generation.
 *
 * Complementent les vecteurs de conformite : ceux-ci verifient l'algorithme,
 * ceux-la verifient que l'interface le pilote correctement — c'est la couche
 * ou une erreur de cablage passerait inapercue (mauvais parametre transmis,
 * mot de passe affiche en clair, champ non reactif).
 */
import { describe, it, expect, beforeEach } from "vitest";
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
    await new Promise((r) => setTimeout(r, 30));

    expect(generated(wrapper)).toBe(canonical.expected);
  });

  it("regenere quand la longueur change", async () => {
    const short = vectors.v1.cases.find((c: any) => c.id === "len-16");

    await wrapper.find("#id_site").setValue(short.site);
    await wrapper.find("#id_clef").setValue(short.master);
    await wrapper.find("#id_longueur").setValue(String(short.length));
    await wrapper.vm.$nextTick();
    await new Promise((r) => setTimeout(r, 30));

    expect(generated(wrapper)).toBe(short.expected);
  });

  // Sans clef, le mot de passe ne dependrait que du site : identique pour tous
  // les utilisateurs, et calculable par quiconque connait le site. Ce test
  // verrouille le refus.
  it("ne genere rien tant que la clef est vide", async () => {
    await wrapper.find("#id_site").setValue("google.com");
    await wrapper.vm.$nextTick();
    await new Promise((r) => setTimeout(r, 30));

    expect(generated(wrapper)).toBe("");
  });
});
