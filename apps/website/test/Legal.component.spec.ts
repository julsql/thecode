/**
 * Pages légales.
 *
 * Elles ne changent pas souvent, mais elles engagent : ce qui est vérifié ici,
 * c'est qu'elles s'affichent en entier, qu'elles disent laquelle des deux
 * langues fait foi, et qu'une information manquante se voit au lieu de passer
 * inaperçue.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory, type Router } from "vue-router";
import Legal from "@/pages/Legal.vue";
import Terms from "@/pages/Terms.vue";
import Privacy from "@/pages/Privacy.vue";
import { IDENTITY, identityPublished } from "@/legal/identity";
import { legalDoc } from "@/legal";
import { resetService } from "@/service";

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
  beforeEach(() => resetService());

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

  it("couvre la connexion Apple, les appareils et l'extension", async () => {
    // Chaque source de données réelle doit y figurer : Apple (et son adresse
    // relais), le nom d'appareil envoyé par le système, la permission
    // « identité » de l'extension, et ce qui ne quitte jamais l'appareil.
    for (const lang of ["fr", "en"]) {
      const doc = legalDoc("privacy", lang, true);
      const text = JSON.stringify(doc);
      expect(text).toContain("Apple Distribution International");
      expect(text).toMatch(/relais privée|private relay/);
      expect(text).toMatch(/nom de l'appareil|device name/);
      expect(text).toMatch(/identité :|identity:/);
      expect(text).toMatch(/Keystore/);
      expect(doc.updated).toMatch(/26 (septembre|September) 2026/);
    }
  });

  it("signale les informations que l'éditrice doit encore fournir", async () => {
    const wrapper = await mountAt(Legal, "/fr/legal");

    // Tant qu'un champ est vide, la page le dit : une mention légale inventée
    // serait pire qu'une mention manquante. Elle n'est simplement pas publiée
    // dans cet état — voir le test suivant.
    const expected = IDENTITY.siret ? IDENTITY.siret : "à compléter";
    expect(wrapper.text()).toContain(expected);
  });

  it("garde les mentions légales hors du site tant que l'identité manque", () => {
    // Le lien du pied de page et l'URL directe dépendent de la même valeur :
    // un seul endroit à remplir, pas d'interrupteur séparé à oublier.
    expect(identityPublished()).toBe(Boolean(IDENTITY.editor && IDENTITY.address));
  });

  it("n'affiche jamais « à compléter » dans la politique de confidentialité", async () => {
    // Celle-là reste publiée : elle ne peut donc pas montrer de trous.
    const wrapper = await mountAt(Privacy, "/fr/privacy");

    expect(wrapper.text()).not.toContain("à compléter");
    expect(wrapper.text()).toContain(IDENTITY.email);
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

describe("documents et offre payante", () => {
  beforeEach(() => resetService());

  it("prévient que les conditions de vente ne s'appliquent pas encore", async () => {
    // Publier des conditions pour une offre qui n'existe pas tromperait sur
    // ce que le service propose.
    const doc = legalDoc("terms", "fr", false);
    expect(doc.intro?.[0]).toContain("Aucune offre payante");

    const open = legalDoc("terms", "fr", true);
    expect(open.intro?.[0]).not.toContain("Aucune offre payante");
  });

  it("dit que Stripe n'intervient pas encore", async () => {
    const doc = legalDoc("privacy", "fr", false);
    expect(doc.intro?.join(" ")).toContain("Stripe n'intervient donc pas encore");
  });
});

describe("page Le projet", () => {
  it("décrit l'algorithme réellement utilisé", async () => {
    const About = (await import("@/pages/About.vue")).default;
    const wrapper = await mountAt(About, "/fr/about");
    const text = wrapper.text();

    // La page annonçait encore un simple SHA-256, qui n'est plus l'algorithme
    // depuis le passage à la v2 : une page qui décrit autre chose que ce que
    // fait le produit est pire qu'une page qui se tait.
    expect(text).toContain("PBKDF2");
    expect(text).toContain("HMAC-SHA256");
    expect(text).toContain("600 000");
    // La v1 n'est mentionnée que pour ce qu'elle est devenue : un héritage.
    expect(text).toContain("v1");
  });
});
