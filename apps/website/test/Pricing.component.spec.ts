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
import Pricing from "@/pages/Pricing.vue";
import AccountVerify from "@/pages/AccountVerify.vue";

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
  beforeEach(() => vi.unstubAllGlobals());

  it("affiche le prix et les plafonds annoncés par le service", async () => {
    vi.stubGlobal("fetch", () =>
      json(200, {
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

  it("s'affiche quand même si le service ne répond pas", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("injoignable")));

    const wrapper = await mountAt(Pricing, "/fr/pricing");

    // Un prix de repli vaut mieux qu'une page vide : le visiteur vient pour
    // savoir combien ça coûte.
    expect(normalize(wrapper.text())).toContain("2 €");
    expect(wrapper.text()).toContain("pas encore ouvert");
  });
});

describe("confirmation d'adresse", () => {
  beforeEach(() => vi.unstubAllGlobals());

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
