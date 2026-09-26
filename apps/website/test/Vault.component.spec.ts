/**
 * Écran carnet : verrou par la clef maîtresse, liste, détail, suppression et
 * renouvellement. Voir shared/spec/vault-lock.md.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resetAutoSyncForTests } from "@/autoSync";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import Vault from "@/pages/Vault.vue";
import { emptyVault, loadVault, newEntry, saveVault } from "@/vault";
import { locked, masterKey, resetMasterKeyForTests } from "@/masterKey";
import { VAULT_GRACE_MS, VAULT_SESSION_KEY } from "@/vaultSession";

const SESSION_KEY = "clef";
const OTHER_KEY = "autre clef";

async function mountVault(lang = "fr") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:lang?", component: Vault }],
  });
  router.push(`/${lang}`);
  await router.isReady();
  const wrapper = mount(Vault, { global: { plugins: [router] }, attachTo: document.body });
  await wrapper.vm.$nextTick();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountVault>>;

const button = (w: Wrapper, label: string) => {
  const found = w.findAll("button").find((b) => b.text() === label);
  if (!found) throw new Error(`bouton introuvable : ${label}`);
  return found;
};

async function unlock(w: Wrapper, key = SESSION_KEY) {
  await w.find("#vault_unlock").setValue(key);
  await w.find("form").trigger("submit");
  await vi.waitFor(() => expect(w.text()).toContain("Entrées"));
}

function seed() {
  const vault = emptyVault();
  const google = newEntry("google.com", { login: "alice", length: 16 });
  const github = newEntry("github.com");
  const gone = { ...newEntry("gone.com"), deleted: true };
  vault.entries.push(google, github, gone);
  saveVault(vault);
  return { google, github };
}

function signInAs(plan: string) {
  localStorage.setItem(
    "thecode.session",
    JSON.stringify({
      endpoint: "http://localhost:0",
      accessToken: "a",
      refreshToken: "r",
      plan,
      kdfSalt: "0WveVfSRJyzta8UsTh5DFw",
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  resetAutoSyncForTests();
  resetMasterKeyForTests();
  document.body.innerHTML = "";
  // refreshPlan interroge le service : on le rend injoignable, l'offre connue
  // reste celle de la session.
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("hors ligne")));
});

describe("verrou par la clef maîtresse", () => {
  it("ne propose ni mot de passe de carnet, ni oubli", async () => {
    const w = await mountVault();
    expect(w.text()).toContain("Carnet verrouillé");
    expect(w.text()).toContain("Déverrouillez le carnet avec votre clef maîtresse.");
    expect(w.find("label[for=vault_unlock]").text()).toBe("Clef maîtresse");
    expect(w.text()).not.toContain("Mot de passe oublié");
    expect(w.text()).not.toContain("mot de passe de carnet");
    expect(w.findAll("input[type=password]")).toHaveLength(1);
  });

  it("nouvelle session : la clef saisie ouvre et devient celle de la session", async () => {
    seed();
    const w = await mountVault();
    expect(w.text()).toContain("Aucune clef n'est encore définie dans cette session");

    await unlock(w);
    expect(masterKey.value).toBe(SESSION_KEY);
    expect(w.find("[role=status]").text()).toContain("générateur");
    expect(w.text()).toContain("google.com");
    expect(document.activeElement?.id).toBe("vaultListTitle");
    // Rien n'est stocké : ni la clef, ni une empreinte.
    expect(JSON.stringify({ ...localStorage })).not.toContain(SESSION_KEY);
    expect(localStorage.getItem("thecode.vaultLock")).toBeNull();
  });

  it("ouvre avec la clef déjà définie dans la session", async () => {
    masterKey.value = SESSION_KEY;
    seed();
    const w = await mountVault();
    expect(w.text()).not.toContain("Aucune clef n'est encore définie");
    await unlock(w);
    expect(w.find("[role=status]").text()).toBe("Carnet déverrouillé.");
    expect(masterKey.value).toBe(SESSION_KEY);
  });

  it("refuse une autre clef que celle en cours d'utilisation", async () => {
    masterKey.value = SESSION_KEY;
    seed();
    const w = await mountVault();

    await w.find("#vault_unlock").setValue(OTHER_KEY);
    await w.find("form").trigger("submit");
    await vi.waitFor(() =>
      expect(w.find("[role=alert]").text()).toBe(
        "Ce n'est pas la même clef que celle en cours d'utilisation.",
      ),
    );
    expect(w.find("#vault_unlock").attributes("aria-invalid")).toBe("true");
    expect(w.text()).not.toContain("google.com");
    expect(masterKey.value).toBe(SESSION_KEY);
    expect(document.activeElement?.id).toBe("vault_unlock");
  });

  it("refuse une saisie vide sans poser de clef", async () => {
    const w = await mountVault();
    await w.find("form").trigger("submit");
    await vi.waitFor(() => expect(w.find("[role=alert]").text()).toContain("clef maîtresse"));
    expect(masterKey.value).toBe("");
  });

  it("liste les entrées non supprimées, sous le rappel « même clef »", async () => {
    seed();
    const w = await mountVault();
    await unlock(w);

    expect(w.findAll(".entry-list li")).toHaveLength(2);
    expect(w.text()).toContain("alice");
    expect(w.text()).not.toContain("gone.com");
    const html = w.html();
    expect(html.indexOf("same-key-hint")).toBeLessThan(html.indexOf("entry-list"));
  });

  it("efface l'ancien verrou au chargement du site", async () => {
    localStorage.setItem("thecode.vaultLock", JSON.stringify({ v: 1, salt: "c2Fs", hash: "aGFz" }));
    const { removeLegacyVaultLock } = await import("@/vaultSession");
    removeLegacyVaultLock();
    expect(localStorage.getItem("thecode.vaultLock")).toBeNull();
  });
});

describe("grâce de 3 minutes", () => {
  beforeEach(() => {
    masterKey.value = SESSION_KEY;
  });

  it("reste ouvert si l'on revient dans les 3 minutes", async () => {
    seed();
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_000_000);
    const first = await mountVault();
    await unlock(first);
    // Changer de page démonte l'écran : l'instant de sortie est retenu.
    first.unmount();
    expect(sessionStorage.getItem(VAULT_SESSION_KEY)).toBe("1000000");

    now.mockReturnValue(1_000_000 + VAULT_GRACE_MS);
    const again = await mountVault();
    expect(again.text()).not.toContain("Carnet verrouillé");
    expect(again.text()).toContain("google.com");
  });

  it("redemande la clef au-delà de 3 minutes", async () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_000_000);
    const first = await mountVault();
    await unlock(first);
    first.unmount();

    now.mockReturnValue(1_000_000 + VAULT_GRACE_MS + 1);
    expect((await mountVault()).text()).toContain("Carnet verrouillé");
  });

  it("ne rouvre rien sans clef dans la session", async () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_000_000);
    const first = await mountVault();
    await unlock(first);
    first.unmount();

    // Rechargement de la page : la clef, en mémoire, est perdue.
    resetMasterKeyForTests();
    now.mockReturnValue(1_000_000 + 1000);
    expect((await mountVault()).text()).toContain("Carnet verrouillé");
  });

  it("referme si l'horloge a reculé", async () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_000_000);
    const first = await mountVault();
    await unlock(first);
    first.unmount();

    now.mockReturnValue(1_000_000 - 1);
    expect((await mountVault()).text()).toContain("Carnet verrouillé");
  });

  it("se reverrouille au retour sur un onglet masqué trop longtemps", async () => {
    const now = vi.spyOn(Date, "now");
    const visibility = vi.spyOn(document, "visibilityState", "get");
    now.mockReturnValue(1_000_000);
    const w = await mountVault();
    await unlock(w);

    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    now.mockReturnValue(1_000_000 + 60_000);
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await w.vm.$nextTick();
    expect(w.text()).not.toContain("Carnet verrouillé");

    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    now.mockReturnValue(1_000_000 + 60_000 + VAULT_GRACE_MS + 1);
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await w.vm.$nextTick();
    expect(w.text()).toContain("Carnet verrouillé");
  });

  it("« Verrouiller » referme aussitôt, sans grâce, et garde la clef", async () => {
    const w = await mountVault();
    await unlock(w);
    await button(w, "Verrouiller").trigger("click");
    expect(w.text()).toContain("Carnet verrouillé");
    expect(masterKey.value).toBe(SESSION_KEY);
    w.unmount();

    expect(sessionStorage.getItem(VAULT_SESSION_KEY)).toBeNull();
    expect((await mountVault()).text()).toContain("Carnet verrouillé");
  });

  it("« Verrouiller » verrouille toute la session, pas seulement l'écran", async () => {
    const w = await mountVault();
    await unlock(w);
    await button(w, "Verrouiller").trigger("click");
    expect(locked.value).toBe(true);
    expect(w.text()).toContain("TheCode verrouillé");
    w.unmount();

    // Même dans la fenêtre de 3 minutes, rien ne se rouvre sans la clef.
    sessionStorage.setItem(VAULT_SESSION_KEY, String(Date.now()));
    const again = await mountVault();
    expect(again.text()).toContain("Carnet verrouillé");

    // Une autre clef ne rouvre rien ; la bonne rouvre toute la session.
    await again.find("#vault_unlock").setValue(OTHER_KEY);
    await again.find("form").trigger("submit");
    expect(locked.value).toBe(true);
    await unlock(again);
    expect(locked.value).toBe(false);
  });

  it("la grâce écoulée referme l'écran sans verrouiller la session", async () => {
    const now = vi.spyOn(Date, "now");
    const visibility = vi.spyOn(document, "visibilityState", "get");
    now.mockReturnValue(1_000_000);
    const w = await mountVault();
    await unlock(w);
    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    now.mockReturnValue(1_000_000 + VAULT_GRACE_MS + 1);
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await w.vm.$nextTick();
    expect(w.text()).toContain("Carnet verrouillé");
    expect(locked.value).toBe(false);
  });
});

describe("détail d'une entrée", () => {
  it("montre les paramètres de l'entrée", async () => {
    const { google } = seed();
    const w = await mountVault();
    await unlock(w);

    await w.findAll(".entry-btn")[0]!.trigger("click");
    await w.vm.$nextTick();

    const detail = w.find("dl").text();
    expect(detail).toContain("google.com");
    expect(detail).toContain("alice");
    expect(detail).toContain("16");
    expect(detail).not.toContain("Version");
    expect(detail).toContain("Création");
    const times = w.findAll("time").map((t) => t.attributes("datetime"));
    expect(times).toStrictEqual([google.createdAt, google.updatedAt]);
    expect(document.activeElement?.id).toBe("vaultDetailTitle");
  });

  it("supprime après confirmation en posant une pierre tombale", async () => {
    const { google } = seed();
    const w = await mountVault();
    await unlock(w);
    await w.findAll(".entry-btn")[0]!.trigger("click");

    await button(w, "Supprimer cette entrée").trigger("click");
    await w.vm.$nextTick();
    // Rien n'est écrit avant la confirmation.
    expect(loadVault().entries.find((e) => e.id === google.id)?.deleted).toBeUndefined();

    await button(w, "Supprimer").trigger("click");
    await w.vm.$nextTick();

    const stored = loadVault().entries.find((e) => e.id === google.id)!;
    expect(stored.deleted).toBe(true);
    expect(stored.updatedAt >= google.updatedAt).toBe(true);
    expect(w.findAll(".entry-list li")).toHaveLength(1);
    expect(w.find("[role=status]").text()).toContain("supprimée");
  });

  it("renouvelle depuis le détail, après avoir montré les deux mots de passe", async () => {
    const { google } = seed();
    signInAs("pro");
    const w = await mountVault();
    await unlock(w);
    await w.findAll(".entry-btn")[0]!.trigger("click");
    await w.vm.$nextTick();

    await button(w, "Renouveler").trigger("submit");
    await vi.waitFor(() => expect(w.text()).toContain("Nouveau mot de passe"), {
      timeout: 10000,
    });
    expect(loadVault().entries.find((e) => e.id === google.id)?.counter).toBe(1);

    await button(w, "Confirmer").trigger("click");
    await w.vm.$nextTick();
    expect(loadVault().entries.find((e) => e.id === google.id)?.counter).toBe(2);
    expect(w.find("dl").text()).toContain("2");
  }, 20000);

  it("refuse le renouvellement à l'offre gratuite", async () => {
    seed();
    const w = await mountVault();
    await unlock(w);
    await w.findAll(".entry-btn")[0]!.trigger("click");
    await w.vm.$nextTick();

    await button(w, "Renouveler").trigger("submit");
    await w.vm.$nextTick();
    expect(w.find("[role=alert]").text()).toContain("offre complète");
    expect(w.text()).not.toContain("Nouveau mot de passe");
  });
});

describe("synchronisation automatique", () => {
  const vaultCalls = () =>
    vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("/v1/vault"));

  afterEach(() => {
    vi.useRealTimers();
  });

  it("synchronise 2 s après un renouvellement", async () => {
    seed();
    signInAs("pro");
    const w = await mountVault();
    await unlock(w);
    await w.findAll(".entry-btn")[0]!.trigger("click");
    await w.vm.$nextTick();
    await button(w, "Renouveler").trigger("submit");
    await vi.waitFor(() => expect(w.text()).toContain("Nouveau mot de passe"), {
      timeout: 10000,
    });

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await button(w, "Confirmer").trigger("click");
    await vi.advanceTimersByTimeAsync(1999);
    expect(vaultCalls()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    vi.useRealTimers();

    await vi.waitFor(() => expect(vaultCalls().length).toBeGreaterThan(0), { timeout: 10000 });
    await vi.waitFor(() => expect(w.find(".sync-auto-status").text()).toContain("injoignable"));
  }, 30000);
});

describe("langue", () => {
  it("se traduit en anglais", async () => {
    const w = await mountVault("en");
    expect(w.text()).toContain("Unlock the vault with your master key.");
    expect(w.find("label[for=vault_unlock]").text()).toBe("Master key");
  });
});
