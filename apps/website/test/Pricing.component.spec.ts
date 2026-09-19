/**
 * Pages des tarifs et de confirmation d'adresse.
 *
 * Deux pages simples, mais qui doivent tenir debout quand le service ne
 * répond pas : l'une annonce un prix, l'autre est au bout d'un lien reçu par
 * courrier. Une page blanche à cet endroit ferait douter du service entier.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory, type Router } from "vue-router";
import { resetService } from "@/service";
import Pricing from "@/pages/Pricing.vue";
import AccountVerify from "@/pages/AccountVerify.vue";
import AccountReset from "@/pages/AccountReset.vue";

const json = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

async function flush() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

function makeRouter(component: unknown): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:lang?/:page*", component: component as never }],
  });
}

/**
 * Intl insère une espace fine insécable avant le symbole monétaire : elle est
 * correcte à l'écran mais invisible dans une assertion, où elle ne ressemble
 * pas à l'espace qu'on a tapée.
 */
const normalize = (text: string) => text.replace(/[\u00a0\u202f\u2009]/g, " ");

async function mountAt(component: unknown, path: string) {
  const router = makeRouter(component);
  router.push(path);
  await router.isReady();
  const wrapper = mount(component as never, { global: { plugins: [router] } });
  await flush();
  return wrapper;
}

describe("page des tarifs", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    resetService();
  });

  it("affiche le prix et les plafonds annoncés par le service", async () => {
    vi.stubGlobal("fetch", () =>
      json(200, {
        plans_enforced: true,
        price_monthly_cents: 200,
        currency: "EUR",
        billing_available: true,
        free_max_entries: 20,
        free_max_devices: 2,
        pro_max_entries: 2000,
        pro_max_devices: 20,
      }),
    );

    const wrapper = await mountAt(Pricing, "/fr/pricing");

    expect(normalize(wrapper.text())).toContain("2 €");
    expect(wrapper.text()).toContain("20 entrées synchronisées");
    expect(wrapper.text()).toContain("2 appareils connectés");
    expect(wrapper.text()).toContain("2000 entrées synchronisées");
  });

  it("n'annonce aucun prix quand le service ne répond pas", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("injoignable")));

    const wrapper = await mountAt(Pricing, "/fr/pricing");

    // Se tromper dans ce sens-là ne coûte qu'un lien absent ; annoncer un prix
    // pour un abonnement impossible à prendre coûterait la confiance.
    expect(wrapper.text()).toContain("Tout est ouvert");
    expect(normalize(wrapper.text())).not.toContain("2 €");
  });

  it("dit que tout est ouvert quand rien n'est vendu", async () => {
    vi.stubGlobal("fetch", () =>
      json(200, {
        plans_enforced: false,
        price_monthly_cents: 200,
        currency: "EUR",
        billing_available: false,
        free_max_entries: 20,
        free_max_devices: 2,
        pro_max_entries: 2000,
        pro_max_devices: 20,
      }),
    );

    const wrapper = await mountAt(Pricing, "/fr/pricing");

    expect(wrapper.text()).toContain("Tout est ouvert");
    expect(wrapper.text()).toContain("2000 entrées synchronisées");
    expect(normalize(wrapper.text())).not.toContain("2 €/mois");
  });
});

describe("confirmation d'adresse", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    resetService();
  });

  it("confirme l'adresse avec le jeton du lien", async () => {
    const seen: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      seen.push({ url, body: JSON.parse(String(init?.body)) });
      return json(200, { verified: true });
    });

    const wrapper = await mountAt(AccountVerify, "/fr/account/verify?token=abc123");

    expect(seen[0].body).toEqual({ token: "abc123" });
    expect(wrapper.text()).toContain("Adresse confirmée");
  });

  it("le dit clairement quand le lien est mort", async () => {
    vi.stubGlobal("fetch", () => json(400, { detail: "Lien invalide" }));

    const wrapper = await mountAt(AccountVerify, "/fr/account/verify?token=perime");

    expect(wrapper.text()).toContain("invalide ou expiré");
  });

  it("ne tente rien sans jeton", async () => {
    const fetchMock = vi.fn(() => json(200, {}));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = await mountAt(AccountVerify, "/fr/account/verify");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("invalide ou expiré");
  });
});

describe("réinitialisation du mot de passe", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    resetService();
  });

  const fill = async (wrapper: any, password: string, confirmation: string) => {
    await wrapper.find("#reset_password").setValue(password);
    await wrapper.find("#reset_password_confirm").setValue(confirmation);
    await wrapper
      .findAll("button")
      .find((b: any) => b.text().includes("Poser ce mot de passe"))!
      .trigger("click");
    await flush();
  };

  it("pose le nouveau mot de passe et ouvre la session", async () => {
    const seen: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      seen.push({ url, body: JSON.parse(String(init?.body)) });
      return json(200, { access_token: "jeton", refresh_token: "renouvellement" });
    });

    const wrapper = await mountAt(AccountReset, "/fr/account/reset?token=abc123");
    await fill(wrapper, "UnNouveauMotDePasse1", "UnNouveauMotDePasse1");

    expect(seen[0].body).toEqual({ token: "abc123", password: "UnNouveauMotDePasse1" });
    // Sans session ouverte ici, on repartirait vers le formulaire de connexion
    // juste après avoir prouvé son identité.
    expect(localStorage.getItem("thecode.session")).toContain("jeton");
    expect(wrapper.text()).toContain("Mot de passe changé");
  });

  it("refuse deux saisies différentes sans rien envoyer", async () => {
    const fetchMock = vi.fn(() => json(200, {}));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = await mountAt(AccountReset, "/fr/account/reset?token=abc123");
    await fill(wrapper, "UnNouveauMotDePasse1", "UnNouveauMotDePasse2");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("ne correspondent pas");
  });

  it("le dit clairement quand le lien est mort", async () => {
    vi.stubGlobal("fetch", () => json(400, { detail: "Lien invalide ou expiré." }));

    const wrapper = await mountAt(AccountReset, "/fr/account/reset?token=perime");
    await fill(wrapper, "UnNouveauMotDePasse1", "UnNouveauMotDePasse1");

    expect(wrapper.text()).toContain("invalide ou expiré");
  });
});
