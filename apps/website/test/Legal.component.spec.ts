/**
 * Pages légales.
 *
 * Elles ne changent pas souvent, mais elles engagent : ce qui est vérifié ici,
 * c'est qu'elles s'affichent en entier, qu'elles disent laquelle des deux
 * langues fait foi, et qu'une information manquante se voit au lieu de passer
 * inaperçue.
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory, type Router } from "vue-router";
import Legal from "@/pages/Legal.vue";
import Terms from "@/pages/Terms.vue";
import Privacy from "@/pages/Privacy.vue";
import { IDENTITY } from "@/legal/identity";
import { legalDoc } from "@/legal";

function makeRouter(component: unknown): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:lang?/:page*", component: component as never }],
  });
}

async function mountAt(component: unknown, path: string) {
  const router = makeRouter(component);
  router.push(path);
  await router.isReady();
  return mount(component as never, { global: { plugins: [router] } });
}

describe("pages légales", () => {
  it("affiche les mentions légales en entier", async () => {
    const wrapper = await mountAt(Legal, "/fr/legal");

    expect(wrapper.text()).toContain("Mentions légales");
    for (const section of legalDoc("legalNotice", "fr").sections) {
      expect(wrapper.text()).toContain(section.heading);
    }
    expect(wrapper.text()).toContain(IDENTITY.email);
  });

  it("affiche les conditions de vente, prix compris", async () => {
    const wrapper = await mountAt(Terms, "/fr/terms");

    expect(wrapper.text()).toContain("Conditions générales de vente");
    expect(wrapper.text()).toContain("par mois");
    // Le point qui compte le plus pour ce service : la clef maîtresse est
    // irrécupérable, et cela doit être écrit avant le premier paiement.
    expect(wrapper.text()).toContain("ne peut pas être récupérée");
  });

  it("dit ce que le service collecte vraiment", async () => {
    const wrapper = await mountAt(Privacy, "/fr/privacy");
    const text = wrapper.text();

    // L'ancienne version affirmait « nous ne collectons aucune donnée ». Avec
    // les comptes, c'était devenu faux.
    expect(text).toContain("adresse e-mail");
    expect(text).toContain("Stripe");
    expect(text).toContain("CNIL");
    expect(text).toContain("Sans compte");
  });

  it("signale les informations que l'éditrice doit encore fournir", async () => {
    const wrapper = await mountAt(Legal, "/fr/legal");

    // Tant qu'un champ est vide, la page le dit : une mention légale inventée
    // serait pire qu'une mention manquante.
    const expected = IDENTITY.siret ? IDENTITY.siret : "à compléter";
    expect(wrapper.text()).toContain(expected);
  });

  it("annonce que la version française fait foi", async () => {
    const wrapper = await mountAt(Terms, "/en/terms");

    expect(wrapper.text()).toContain("French version is the one that governs");
  });

  it("met en valeur sans laisser passer de HTML", async () => {
    const wrapper = await mountAt(Terms, "/fr/terms");

    // Les textes sont du texte : seule l'emphase est interprétée, et une
    // phrase juridique n'a aucune raison de pouvoir injecter du HTML.
    expect(wrapper.html()).toContain("<strong>");
    expect(wrapper.html()).not.toContain("<script");
  });
});
