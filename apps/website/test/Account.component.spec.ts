/**
 * Page du compte.
 *
 * Le site est le seul endroit où l'on crée un compte, où l'on paie et où l'on
 * déconnecte un appareil. Ce qui est vérifié ici, c'est le câblage : ce que
 * l'écran envoie au service, et ce qu'il en montre.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory, type Router } from "vue-router";
import Account from "@/pages/Account.vue";

/** Ce que le faux service a reçu : c'est la vraie matière du test. */
interface Call {
  url: string;
  method: string;
  body: Record<string, unknown> | null;
}

function fakeService(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const state = {
    devices: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        label: "site web",
        created_at: "2026-09-01T10:00:00Z",
        expires_at: "2026-10-01T10:00:00Z",
      },
    ],
    me: {
      email: "julie@exemple.fr",
      plan: "free",
      subscription_status: "active",
      revision: 3,
      entry_count: 4,
      max_entries: 20,
      email_verified: false,
      plan_source: "none",
      device_count: 1,
      max_devices: 2,
      current_period_end: null,
      has_pending_coupon: false,
      billing_available: true,
      ...overrides,
    },
  };

  const json = (status: number, body: unknown) =>
    Promise.resolve({
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
    } as Response);

  const fetchImpl = (url: string, init?: RequestInit) => {
    const method = init?.method ?? (init?.body ? "POST" : "GET");
    const body = init?.body ? JSON.parse(init.body as string) : null;
    calls.push({ url, method, body });

    if (url.endsWith("/v1/billing/plans")) {
      return json(200, {
        price_monthly_cents: 200,
        currency: "EUR",
        billing_available: true,
        free_max_entries: 20,
        free_max_devices: 2,
        pro_max_entries: 2000,
        pro_max_devices: 20,
      });
    }
    if (url.endsWith("/v1/auth/registration")) {
      return json(200, { open: true, needsCode: false, freeSlots: 3 });
    }
    if (url.endsWith("/v1/auth/register") || url.endsWith("/v1/auth/login")) {
      return json(200, { access_token: "jeton", refresh_token: "renouvellement" });
    }
    if (url.endsWith("/v1/auth/me")) return json(200, state.me);
    if (url.endsWith("/v1/account/devices")) return json(200, state.devices);
    if (url.includes("/v1/account/devices/")) {
      state.devices = [];
      state.me = { ...state.me, device_count: 0 };
      return json(204, null);
    }
    if (url.endsWith("/v1/account/code")) {
      state.me = { ...state.me, plan: "pro", plan_source: "lifetime" };
      return json(200, { kind: "lifetime", message: "Offre complète activée à vie." });
    }
    if (url.endsWith("/v1/billing/checkout")) {
      return json(200, { url: "https://stripe.test/paiement" });
    }
    return json(404, { detail: "inconnu" });
  };

  vi.stubGlobal("fetch", vi.fn(fetchImpl));
  return { calls, state };
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:lang?/:page*", component: Account }],
  });
}

async function mountAccount(path = "/fr/account") {
  const router = makeRouter();
  router.push(path);
  await router.isReady();
  const wrapper = mount(Account, { global: { plugins: [router] } });
  await flush();
  return wrapper;
}

/** Laisse les appels au service se terminer avant de regarder l'écran. */
async function flush() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

const button = (wrapper: ReturnType<typeof mount>, text: string) =>
  wrapper.findAll("button").find((b) => b.text().includes(text));

describe("page du compte", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    // Le redirige vers Stripe ne doit pas faire naviguer jsdom.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign: vi.fn(), href: "" },
    });
  });

  describe("création de compte", () => {
    it("refuse deux mots de passe différents sans rien envoyer", async () => {
      const service = fakeService();
      const wrapper = await mountAccount();

      await button(wrapper, "Créer un compte")!.trigger("click");
      await wrapper.find("#acc_email").setValue("julie@exemple.fr");
      await wrapper.find("#acc_password").setValue("MotDePasseAssezLong1");
      await wrapper.find("#acc_password_confirm").setValue("MotDePasseAssezLong2");
      await button(wrapper, "Créer mon compte")!.trigger("click");
      await flush();

      expect(wrapper.text()).toContain("ne correspondent pas");
      expect(service.calls.some((c) => c.url.endsWith("/v1/auth/register"))).toBe(false);
    });

    it("refuse un mot de passe trop court", async () => {
      const service = fakeService();
      const wrapper = await mountAccount();

      await button(wrapper, "Créer un compte")!.trigger("click");
      await wrapper.find("#acc_email").setValue("julie@exemple.fr");
      await wrapper.find("#acc_password").setValue("court");
      await wrapper.find("#acc_password_confirm").setValue("court");
      await button(wrapper, "Créer mon compte")!.trigger("click");
      await flush();

      expect(wrapper.text()).toContain("12 caractères");
      expect(service.calls.some((c) => c.url.endsWith("/v1/auth/register"))).toBe(false);
    });

    it("envoie le code de parrainage et la langue, puis ouvre la session", async () => {
      const service = fakeService();
      const wrapper = await mountAccount();

      await button(wrapper, "Créer un compte")!.trigger("click");
      await wrapper.find("#acc_email").setValue("julie@exemple.fr");
      await wrapper.find("#acc_password").setValue("MotDePasseAssezLong1");
      await wrapper.find("#acc_password_confirm").setValue("MotDePasseAssezLong1");
      await wrapper.find("#acc_code").setValue("PARRAIN");
      // L'offre gratuite, pour rester sur la page plutôt que partir chez Stripe.
      await button(wrapper, "Gratuite")!.trigger("click");
      await button(wrapper, "Créer mon compte")!.trigger("click");
      await flush();

      const sent = service.calls.find((c) => c.url.endsWith("/v1/auth/register"));
      expect(sent?.body).toMatchObject({
        email: "julie@exemple.fr",
        invite_code: "PARRAIN",
        // Le lien de vérification mène au site, qui est traduit.
        lang: "fr",
      });
      expect(localStorage.getItem("thecode.session")).toContain("jeton");
    });

    it("mène au paiement quand l'offre complète est choisie", async () => {
      const service = fakeService();
      const wrapper = await mountAccount();

      await button(wrapper, "Créer un compte")!.trigger("click");
      await wrapper.find("#acc_email").setValue("julie@exemple.fr");
      await wrapper.find("#acc_password").setValue("MotDePasseAssezLong1");
      await wrapper.find("#acc_password_confirm").setValue("MotDePasseAssezLong1");
      await button(wrapper, "Créer mon compte")!.trigger("click");
      await flush();

      const checkout = service.calls.find((c) => c.url.endsWith("/v1/billing/checkout"));
      expect(checkout).toBeDefined();
      // Le retour reste sur le site, dans la langue courante.
      expect(checkout?.body).toMatchObject({ return_path: "/fr/account" });
    });
  });

  describe("compte connecté", () => {
    beforeEach(() => {
      localStorage.setItem(
        "thecode.session",
        JSON.stringify({
          endpoint: "https://thecode-api.julsql.fr",
          accessToken: "jeton",
          refreshToken: "renouvellement",
        }),
      );
    });

    it("montre l'offre, la consommation et les appareils", async () => {
      fakeService();
      const wrapper = await mountAccount();

      expect(wrapper.text()).toContain("julie@exemple.fr");
      expect(wrapper.text()).toContain("4 / 20");
      expect(wrapper.text()).toContain("1 / 2");
      expect(wrapper.text()).toContain("site web");
    });

    it("signale une adresse non confirmée", async () => {
      fakeService();
      const wrapper = await mountAccount();

      expect(wrapper.text()).toContain("pas encore confirmée");
      expect(button(wrapper, "Renvoyer le lien")).toBeDefined();
    });

    it("déconnecte un appareil", async () => {
      const service = fakeService();
      const wrapper = await mountAccount();

      await button(wrapper, "Déconnecter")!.trigger("click");
      await flush();

      const revoked = service.calls.find((c) => c.method === "DELETE");
      expect(revoked?.url).toContain("/v1/account/devices/11111111");
      expect(wrapper.text()).toContain("Aucun appareil connecté");
    });

    it("applique un code et montre la nouvelle offre", async () => {
      const service = fakeService();
      const wrapper = await mountAccount();

      await wrapper.find("#acc_redeem").setValue("AVIE");
      await button(wrapper, "Appliquer")!.trigger("click");
      await flush();

      expect(service.calls.find((c) => c.url.endsWith("/v1/account/code"))?.body).toEqual({
        code: "AVIE",
      });
      expect(wrapper.text()).toContain("à vie");
    });

    it("transmet le code promo au paiement", async () => {
      const service = fakeService();
      const wrapper = await mountAccount();

      await wrapper.find("#acc_promo").setValue("REMISE20");
      await button(wrapper, "Prendre l'offre complète")!.trigger("click");
      await flush();

      expect(service.calls.find((c) => c.url.endsWith("/v1/billing/checkout"))?.body).toMatchObject(
        { promo_code: "REMISE20" },
      );
    });

    it("propose de gérer l'abonnement quand il est payé", async () => {
      fakeService({ plan: "pro", plan_source: "stripe" });
      const wrapper = await mountAccount();

      expect(button(wrapper, "Gérer mon abonnement")).toBeDefined();
      expect(button(wrapper, "Prendre l'offre complète")).toBeUndefined();
    });

    it("oublie la session à la déconnexion", async () => {
      fakeService();
      const wrapper = await mountAccount();

      await button(wrapper, "Se déconnecter")!.trigger("click");
      await flush();

      expect(localStorage.getItem("thecode.session")).toBeNull();
      expect(wrapper.find("#acc_email").exists()).toBe(true);
    });

    it("revient au formulaire quand le jeton est mort", async () => {
      const json = (status: number, body: unknown) =>
        Promise.resolve({
          ok: status < 400,
          status,
          json: () => Promise.resolve(body),
        } as Response);
      // 401 partout : ni l'appel, ni le renouvellement ne passent.
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string) =>
          url.endsWith("/v1/billing/plans") || url.endsWith("/v1/auth/registration")
            ? json(200, {})
            : json(401, { detail: "Jeton expiré" }),
        ),
      );

      const wrapper = await mountAccount();

      // Prétendre être connecté sans rien pouvoir faire serait pire que de
      // redemander le mot de passe.
      expect(wrapper.find("#acc_email").exists()).toBe(true);
      expect(localStorage.getItem("thecode.session")).toBeNull();
    });
  });
});
