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
import { renderGoogleButton } from "@/google";
import { resetService } from "@/service";

/**
 * Le script de Google n'est pas chargé en test : ce qui est vérifié ici, c'est
 * ce que la page fait du jeton, pas la façon dont Google le fabrique.
 */
vi.mock("@/google", () => ({
  renderGoogleButton: vi.fn(async () => true),
}));

/** Rejoue le retour de Google, comme le ferait son bouton. */
async function returnFromGoogle(idToken: string) {
  const calls = vi.mocked(renderGoogleButton).mock.calls;
  const callback = calls[calls.length - 1]?.[2];
  await callback?.(idToken);
}

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
      has_password: true,
      google_linked: false,
      pending_email: "",
      device_count: 1,
      max_devices: 2,
      current_period_end: null,
      has_pending_coupon: false,
      billing_available: true,
      plans_enforced: true,
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
        plans_enforced: true,
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
      return json(200, {
        open: true,
        needsCode: false,
        freeSlots: 3,
        googleClientId: "client-de-test",
      });
    }
    if (url.endsWith("/v1/auth/google")) {
      state.me = { ...state.me, google_linked: true, has_password: false };
      return json(200, { access_token: "jeton", refresh_token: "renouvellement" });
    }
    if (url.endsWith("/v1/auth/password/forgot")) return json(202, { sent: true });
    if (url.endsWith("/v1/account/password")) return json(200, { changed: true });
    if (url.endsWith("/v1/account/email")) {
      state.me = { ...state.me, pending_email: body?.new_email };
      return json(202, { sent: true });
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
    if (url.endsWith("/v1/account/export")) {
      return json(200, { account: { email: "julie@exemple.fr" }, vault: [] });
    }
    if (url.endsWith("/v1/account/google") && method === "DELETE") {
      state.me = { ...state.me, google_linked: false };
      return json(204, null);
    }
    if (url.endsWith("/v1/account") && method === "DELETE") return json(204, null);
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
    // L'état du service est lu une fois par page : sans remise à zéro, la
    // première réponse vaudrait pour tous les tests suivants.
    resetService();
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
      await wrapper.find("#acc_password").setValue("mot-de-passe-de-test");
      await wrapper.find("#acc_password_confirm").setValue("mot-de-passe-different");
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
      await wrapper.find("#acc_password").setValue("mot-de-passe-de-test");
      await wrapper.find("#acc_password_confirm").setValue("mot-de-passe-de-test");
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
      await wrapper.find("#acc_password").setValue("mot-de-passe-de-test");
      await wrapper.find("#acc_password_confirm").setValue("mot-de-passe-de-test");
      await button(wrapper, "Créer mon compte")!.trigger("click");
      await flush();

      const checkout = service.calls.find((c) => c.url.endsWith("/v1/billing/checkout"));
      expect(checkout).toBeDefined();
      // Le retour reste sur le site, dans la langue courante.
      expect(checkout?.body).toMatchObject({ return_path: "/fr/account" });
    });
  });

  describe("Google", () => {
    it("ouvre la session avec le jeton rendu par Google", async () => {
      const service = fakeService();
      await mountAccount();

      await returnFromGoogle("jeton-google");
      await flush();

      const sent = service.calls.find((c) => c.url.endsWith("/v1/auth/google"));
      expect(sent?.body).toMatchObject({ id_token: "jeton-google", lang: "fr" });
      expect(localStorage.getItem("thecode.session")).toContain("jeton");
    });

    it("transmet le code de parrainage saisi", async () => {
      const service = fakeService();
      const wrapper = await mountAccount();

      await button(wrapper, "Créer un compte")!.trigger("click");
      await wrapper.find("#acc_code").setValue("PARRAIN");
      await returnFromGoogle("jeton-google");
      await flush();

      expect(service.calls.find((c) => c.url.endsWith("/v1/auth/google"))?.body).toMatchObject({
        invite_code: "PARRAIN",
      });
    });
  });

  describe("mot de passe oublié", () => {
    it("demande un lien sans rien dire de l'existence du compte", async () => {
      const service = fakeService();
      const wrapper = await mountAccount();

      await wrapper.find("#acc_email").setValue("julie@exemple.fr");
      await button(wrapper, "Mot de passe oublié")!.trigger("click");
      await flush();

      expect(service.calls.find((c) => c.url.endsWith("/v1/auth/password/forgot"))?.body).toEqual({
        email: "julie@exemple.fr",
        lang: "fr",
      });
      // Le même message dans tous les cas : dire « adresse inconnue »
      // transformerait la page en annuaire des comptes.
      expect(wrapper.text()).toContain("un lien vient de partir");
    });

    it("réclame l'adresse avant d'envoyer quoi que ce soit", async () => {
      const service = fakeService();
      const wrapper = await mountAccount();

      await button(wrapper, "Mot de passe oublié")!.trigger("click");
      await flush();

      expect(service.calls.some((c) => c.url.includes("/forgot"))).toBe(false);
    });
  });

  describe("arrivée depuis une application", () => {
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

    it("ne montre ni prix ni abonnement, même quand le paiement est ouvert", async () => {
      // Les règles des magasins interdisent qu'une app oriente vers un
      // paiement hors de leur système, et un examinateur suit les liens.
      fakeService({ plan: "free" });
      const wrapper = await mountAccount("/fr/account?from=app");

      expect(button(wrapper, "Prendre l'offre complète")).toBeUndefined();
      expect(wrapper.text()).not.toContain("Tarifs");
      // Le reste de la page fonctionne : c'est un formulaire de compte.
      expect(wrapper.text()).toContain("julie@exemple.fr");
    });

    it("garde l'offre visible quand on vient du site", async () => {
      fakeService({ plan: "free" });
      const wrapper = await mountAccount();

      expect(button(wrapper, "Prendre l'offre complète")).toBeDefined();
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

    it("refuse deux nouveaux mots de passe différents", async () => {
      const service = fakeService();
      const wrapper = await mountAccount();

      await wrapper.find("#acc_current_password").setValue("mot-de-passe-de-test");
      await wrapper.find("#acc_new_password").setValue("nouveau-mot-de-passe-de-test");
      await wrapper.find("#acc_new_password_confirm").setValue("nouveau-mot-de-passe-autre");
      await button(wrapper, "Changer mon mot de passe")!.trigger("click");
      await flush();

      expect(wrapper.text()).toContain("ne correspondent pas");
      expect(service.calls.some((c) => c.url.endsWith("/v1/account/password"))).toBe(false);
    });

    it("change le mot de passe", async () => {
      const service = fakeService();
      const wrapper = await mountAccount();

      await wrapper.find("#acc_current_password").setValue("mot-de-passe-de-test");
      await wrapper.find("#acc_new_password").setValue("nouveau-mot-de-passe-de-test");
      await wrapper.find("#acc_new_password_confirm").setValue("nouveau-mot-de-passe-de-test");
      await button(wrapper, "Changer mon mot de passe")!.trigger("click");
      await flush();

      expect(service.calls.find((c) => c.url.endsWith("/v1/account/password"))?.body).toEqual({
        current_password: "mot-de-passe-de-test",
        new_password: "nouveau-mot-de-passe-de-test",
      });
      expect(wrapper.text()).toContain("autres appareils");
    });

    it("propose de définir un mot de passe à un compte Google", async () => {
      fakeService({ has_password: false, google_linked: true });
      const wrapper = await mountAccount();

      // C'est ce qui lui ouvre les applications, qui se connectent avec une
      // adresse et un mot de passe.
      expect(button(wrapper, "Définir un mot de passe")).toBeDefined();
      expect(wrapper.find("#acc_current_password").exists()).toBe(false);
    });

    it("demande un changement d'adresse et montre l'attente", async () => {
      const service = fakeService();
      const wrapper = await mountAccount();

      await wrapper.find("#acc_new_email").setValue("nouvelle@exemple.fr");
      await wrapper.find("#acc_email_password").setValue("mot-de-passe-de-test");
      await button(wrapper, "Changer mon adresse")!.trigger("click");
      await flush();

      expect(service.calls.find((c) => c.url.endsWith("/v1/account/email"))?.body).toMatchObject({
        new_email: "nouvelle@exemple.fr",
      });
      // Rien ne change avant le lien : l'écran doit le montrer, sinon on
      // refait la demande en croyant qu'elle n'est pas passée.
      expect(wrapper.text()).toContain("nouvelle@exemple.fr");
    });

    it("refuse la suppression tant que l'adresse n'est pas recopiée", async () => {
      const service = fakeService();
      const wrapper = await mountAccount();

      const remove = button(wrapper, "Supprimer mon compte")!;
      expect(remove.attributes("disabled")).toBeDefined();

      await wrapper.find("#acc_delete_email").setValue("julie@exemple.fr");
      await flush();
      expect(button(wrapper, "Supprimer mon compte")!.attributes("disabled")).toBeUndefined();
      expect(
        service.calls.some((c) => c.method === "DELETE" && c.url.endsWith("/v1/account")),
      ).toBe(false);
    });

    it("supprime le compte et oublie la session", async () => {
      const service = fakeService();
      const wrapper = await mountAccount();

      await wrapper.find("#acc_delete_email").setValue("julie@exemple.fr");
      await wrapper.find("#acc_delete_password").setValue("mot-de-passe-de-test");
      await button(wrapper, "Supprimer mon compte")!.trigger("click");
      await flush();

      const sent = service.calls.find(
        (c) => c.method === "DELETE" && c.url.endsWith("/v1/account"),
      );
      expect(sent?.body).toEqual({
        password: "mot-de-passe-de-test",
        confirm_email: "julie@exemple.fr",
      });
      expect(localStorage.getItem("thecode.session")).toBeNull();
      expect(wrapper.find("#acc_email").exists()).toBe(true);
    });

    it("télécharge les données du compte", async () => {
      const service = fakeService();
      // jsdom ne sait pas fabriquer d'URL d'objet : seule compte la demande.
      const created = vi.fn(() => "blob:test");
      vi.stubGlobal("URL", { createObjectURL: created, revokeObjectURL: vi.fn() });

      const wrapper = await mountAccount();
      await button(wrapper, "Télécharger mes données")!.trigger("click");
      await flush();

      expect(service.calls.some((c) => c.url.endsWith("/v1/account/export"))).toBe(true);
      expect(created).toHaveBeenCalled();
    });

    it("propose de délier Google une fois un mot de passe défini", async () => {
      const service = fakeService({ google_linked: true, has_password: true });
      const wrapper = await mountAccount();

      const unlink = button(wrapper, "Délier Google")!;
      expect(unlink.attributes("disabled")).toBeUndefined();

      await unlink.trigger("click");
      await flush();

      expect(
        service.calls.some((c) => c.method === "DELETE" && c.url.endsWith("/v1/account/google")),
      ).toBe(true);
      expect(wrapper.text()).toContain("Aucun compte Google lié");
    });

    it("interdit de délier Google tant qu'il n'y a pas de mot de passe", async () => {
      const service = fakeService({ google_linked: true, has_password: false });
      const wrapper = await mountAccount();

      // Ce serait fermer la seule porte d'entrée du compte.
      expect(button(wrapper, "Délier Google")!.attributes("disabled")).toBeDefined();
      expect(wrapper.text()).toContain("Définissez d'abord un mot de passe");
      expect(service.calls.some((c) => c.url.endsWith("/v1/account/google"))).toBe(false);
    });

    it("montre les deux portes d'entrée du compte", async () => {
      fakeService({ google_linked: true, has_password: true });
      const wrapper = await mountAccount();

      expect(wrapper.text()).toContain("Mot de passe défini");
      expect(wrapper.text()).toContain("Compte Google lié");
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
