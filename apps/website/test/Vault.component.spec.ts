/**
 * Écran carnet : verrou, liste, détail, suppression et renouvellement.
 * Voir shared/spec/vault-lock.md.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import Vault from "@/pages/Vault.vue";
import {
  emptyVault,
  loadVault,
  newEntry,
  saveVault,
  VAULT_STORAGE_KEY,
  type VaultEntry,
} from "@/vault";
import { createLock, hasLock, verifyLock } from "@/vaultLock";

const PASSWORD = "mot de passe";

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

async function unlock(w: Wrapper) {
  await w.find("#vault_unlock").setValue(PASSWORD);
  await w.find("form").trigger("submit");
  await vi.waitFor(() => expect(w.text()).toContain("Entrées"), { timeout: 10000 });
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
    JSON.stringify({ endpoint: "http://localhost:0", accessToken: "a", refreshToken: "r", plan }),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  // refreshPlan interroge le service : on le rend injoignable, l'offre connue
  // reste celle de la session.
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("hors ligne")));
});

describe("première ouverture", () => {
  it("exige un mot de passe saisi deux fois, 8 caractères minimum", async () => {
    const w = await mountVault();
    expect(w.text()).toContain("Créer un mot de passe de carnet");
    expect(w.find("label[for=vault_new]").exists()).toBe(true);

    await w.find("#vault_new").setValue("court");
    await w.find("#vault_new_confirm").setValue("court");
    await w.find("form").trigger("submit");
    await vi.waitFor(() => expect(w.find("[role=alert]").text()).toContain("8 caractères"));
    expect(w.find("#vault_new").attributes("aria-invalid")).toBe("true");

    await w.find("#vault_new").setValue(PASSWORD);
    await w.find("#vault_new_confirm").setValue("autre chose");
    await w.find("form").trigger("submit");
    await vi.waitFor(() => expect(w.find("[role=alert]").text()).toContain("diffèrent"));
    expect(hasLock()).toBe(false);

    await w.find("#vault_new_confirm").setValue(PASSWORD);
    await w.find("form").trigger("submit");
    await vi.waitFor(() => expect(w.text()).toContain("Entrées"), { timeout: 10000 });
    expect(await verifyLock(PASSWORD)).toBe(true);
    expect(document.activeElement?.id).toBe("vaultListTitle");
  }, 20000);
});

describe("verrou", () => {
  beforeEach(async () => {
    await createLock(PASSWORD, PASSWORD);
  });

  it("refuse un mauvais mot de passe", async () => {
    seed();
    const w = await mountVault();
    expect(w.text()).toContain("Carnet verrouillé");
    expect(w.text()).not.toContain("google.com");

    await w.find("#vault_unlock").setValue("mauvais mdp");
    await w.find("form").trigger("submit");
    await vi.waitFor(() => expect(w.find("[role=alert]").text()).toContain("incorrect"));
    expect(w.text()).not.toContain("google.com");
  });

  it("liste les entrées non supprimées une fois déverrouillé", async () => {
    seed();
    const w = await mountVault();
    await unlock(w);

    const items = w.findAll(".entry-list li");
    expect(items).toHaveLength(2);
    expect(w.text()).toContain("google.com");
    expect(w.text()).toContain("alice");
    expect(w.text()).not.toContain("gone.com");
  });

  it("garde une entrée portant un v résiduel", async () => {
    // Écrit à la main : le carnet ne réécrit jamais `v`.
    const vault = emptyVault();
    vault.entries.push({ ...newEntry("old.com"), v: 1 } as VaultEntry);
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
    const w = await mountVault();
    await unlock(w);

    expect(w.findAll(".entry-list li")).toHaveLength(1);
    expect(w.text()).toContain("old.com");
  });

  it("ne mémorise pas le déverrouillage", async () => {
    const first = await mountVault();
    await unlock(first);
    first.unmount();

    const again = await mountVault();
    expect(again.text()).toContain("Carnet verrouillé");
  });

  it("se reverrouille à la demande", async () => {
    const w = await mountVault();
    await unlock(w);
    await button(w, "Verrouiller").trigger("click");
    expect(w.text()).toContain("Carnet verrouillé");
  });

  it("efface le carnet local après confirmation si le mot de passe est oublié", async () => {
    seed();
    const w = await mountVault();

    await button(w, "Mot de passe oublié").trigger("click");
    await w.vm.$nextTick();
    expect(w.text()).toContain("Effacer le carnet local ?");
    expect(document.activeElement?.id).toBe("vaultForgetTitle");

    // Annuler ne touche à rien.
    await button(w, "Annuler").trigger("click");
    expect(hasLock()).toBe(true);

    await button(w, "Mot de passe oublié").trigger("click");
    await button(w, "Effacer le carnet et le mot de passe").trigger("click");
    await w.vm.$nextTick();

    expect(hasLock()).toBe(false);
    expect(loadVault().entries).toHaveLength(0);
    expect(w.text()).toContain("Créer un mot de passe de carnet");
  });

  it("change le mot de passe en exigeant l'actuel", async () => {
    const w = await mountVault();
    await unlock(w);

    await w.find("#vault_current").setValue("mauvais mdp");
    await w.find("#vault_next").setValue("nouveau mdp");
    await w.find("#vault_next_confirm").setValue("nouveau mdp");
    await button(w, "Changer le mot de passe").trigger("submit");
    await vi.waitFor(() => expect(w.find("[role=alert]").text()).toContain("incorrect"), {
      timeout: 10000,
    });

    await w.find("#vault_current").setValue(PASSWORD);
    await w.find("#vault_next").setValue("nouveau mdp");
    await w.find("#vault_next_confirm").setValue("nouveau mdp");
    await button(w, "Changer le mot de passe").trigger("submit");
    await vi.waitFor(() => expect(w.find("[role=status]").text()).toContain("changé"), {
      timeout: 10000,
    });
    expect(await verifyLock("nouveau mdp")).toBe(true);
  }, 30000);
});

describe("détail d'une entrée", () => {
  beforeEach(async () => {
    await createLock(PASSWORD, PASSWORD);
  });

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

    await w.find("#vault_clef").setValue("clef");
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

    await w.find("#vault_clef").setValue("clef");
    await button(w, "Renouveler").trigger("submit");
    await w.vm.$nextTick();
    expect(w.find("[role=alert]").text()).toContain("offre complète");
    expect(w.text()).not.toContain("Nouveau mot de passe");
  });
});

describe("langue", () => {
  it("se traduit en anglais", async () => {
    const w = await mountVault("en");
    expect(w.text()).toContain("Create a vault password");
    expect(w.text()).toContain("At least 8 characters.");
  });
});
