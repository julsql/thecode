/**
 * Réglages par défaut : retenus dans le navigateur, partagés avec le compte.
 * Voir shared/spec/default-settings.md.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import Generate from "@/pages/Generate.vue";
import { deriveTransferKey } from "@/transfer";
import { clearSession, saveSession, syncSettings } from "@/sync";
import {
  factorySettings,
  loadSettings,
  normalizeSettings,
  rememberSettings,
  saveSettings,
  SETTINGS_STORAGE_KEY,
  type DefaultSettings,
} from "@/settings";

const SESSION = { endpoint: "https://example.test/api", accessToken: "a", refreshToken: "r" };
const OLD = "2026-01-01T00:00:00Z";
const NEW = "2026-02-01T00:00:00Z";

function settings(
  length: number,
  updatedAt: string,
  charset: Partial<DefaultSettings["charset"]> = {},
): DefaultSettings {
  return {
    length,
    charset: { lower: true, upper: true, symbols: true, numbers: true, ...charset },
    updatedAt,
  };
}

const b64 = (buf: ArrayBuffer | Uint8Array) =>
  Buffer.from(new Uint8Array(buf)).toString("base64url");

async function encryptFor(value: unknown, masterKey: string) {
  const key = await deriveTransferKey(masterKey);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plain);
  return { nonce: b64(nonce), blob: b64(cipher) };
}

async function decryptWith(row: { nonce: string; blob: string }, masterKey: string) {
  const key = await deriveTransferKey(masterKey);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(row.nonce, "base64url") },
    key,
    Buffer.from(row.blob, "base64url"),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

/** Serveur en mémoire : carnet vide, un blob de réglages par compte. */
function fakeServer(initial: { nonce: string; blob: string } | null = null) {
  let stored = initial;
  let revision = 0;
  const puts: string[] = [];
  const reply = (status: number, body?: unknown) =>
    Promise.resolve({
      ok: status < 400,
      status,
      statusText: String(status),
      json: () => Promise.resolve(body),
    } as Response);

  const fetchImpl = (url: string, init: RequestInit = {}) => {
    if (url.endsWith("/v1/settings")) {
      if (init.method === "PUT") {
        puts.push(init.body as string);
        stored = JSON.parse(init.body as string);
        return reply(204);
      }
      return stored ? reply(200, stored) : reply(204);
    }
    if (url.endsWith("/v1/vault")) {
      if (!init.body) return reply(200, { revision, entries: [] });
      revision += 1;
      return reply(200, { revision, accepted: 0 });
    }
    return reply(404, { detail: "absent" });
  };

  return {
    fetchImpl,
    puts,
    get stored() {
      return stored;
    },
  };
}

describe("réglages retenus", () => {
  beforeEach(() => localStorage.clear());

  it("rend les valeurs d'usine sans rien de retenu", () => {
    expect(loadSettings()).toStrictEqual(factorySettings());
  });

  it("date une modification, pas une valeur inchangée", () => {
    rememberSettings({ length: 20, charset: factorySettings().charset });
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();

    const saved = rememberSettings({ length: 30, charset: factorySettings().charset });
    expect(saved.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(loadSettings()).toStrictEqual(saved);
  });

  it("ne retient pas des réglages sans aucun jeu coché", () => {
    rememberSettings({
      length: 20,
      charset: { lower: false, upper: false, symbols: false, numbers: false },
    });
    expect(loadSettings()).toStrictEqual(factorySettings());
  });

  it("repart des valeurs d'usine sur un stockage illisible", () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, "{pas du json");
    expect(loadSettings()).toStrictEqual(factorySettings());
  });

  it("survit à un stockage indisponible", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("navigation privée");
    });
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("navigation privée");
    });
    expect(loadSettings()).toStrictEqual(factorySettings());
    expect(() => saveSettings(settings(30, NEW))).not.toThrow();
    spy.mockRestore();
    setSpy.mockRestore();
  });

  it("borne la longueur et rejette ce qui n'est pas des réglages", () => {
    expect(normalizeSettings(settings(99, NEW))!.length).toBe(40);
    expect(normalizeSettings(settings(1, NEW))!.length).toBe(4);
    expect(normalizeSettings(null)).toBeNull();
    expect(normalizeSettings({ length: 20 })).toBeNull();
  });
});

describe("syncSettings", () => {
  let server: ReturnType<typeof fakeServer>;
  function useServer(initial: { nonce: string; blob: string } | null = null) {
    server = fakeServer(initial);
    vi.stubGlobal("fetch", server.fetchImpl);
  }
  afterEach(() => vi.unstubAllGlobals());

  it("pousse, chiffrés, des réglages locaux quand le compte n'en a pas", async () => {
    useServer();
    const local = settings(32, NEW);

    const res = await syncSettings(local, "clef", SESSION);

    expect(res.applied).toBe(false);
    expect(server.puts).toHaveLength(1);
    expect(Object.keys(server.stored!).sort()).toStrictEqual(["blob", "nonce"]);
    expect(await decryptWith(server.stored!, "clef")).toStrictEqual(local);
  });

  it("ne pousse pas des réglages jamais modifiés", async () => {
    useServer();
    await syncSettings(factorySettings(), "clef", SESSION);
    expect(server.puts).toHaveLength(0);
  });

  it("applique la distante plus récente sans la repousser", async () => {
    useServer(await encryptFor(settings(12, NEW, { symbols: false }), "clef"));

    const res = await syncSettings(settings(30, OLD), "clef", SESSION);

    expect(res.applied).toBe(true);
    expect(res.settings).toStrictEqual(settings(12, NEW, { symbols: false }));
    expect(server.puts).toHaveLength(0);
  });

  it("garde la distante à égalité", async () => {
    useServer(await encryptFor(settings(12, NEW), "clef"));
    const res = await syncSettings(settings(30, NEW), "clef", SESSION);
    expect(res.applied).toBe(true);
    expect(res.settings.length).toBe(12);
  });

  it("pousse la locale plus récente", async () => {
    useServer(await encryptFor(settings(12, OLD), "clef"));

    const res = await syncSettings(settings(30, NEW), "clef", SESSION);

    expect(res.applied).toBe(false);
    expect((await decryptWith(server.stored!, "clef")).length).toBe(30);
  });

  it("ignore un blob indéchiffrable sans rien écraser", async () => {
    const foreign = await encryptFor(settings(12, OLD), "autre-clef");
    useServer(foreign);

    const res = await syncSettings(settings(30, NEW), "clef", SESSION);

    expect(res.applied).toBe(false);
    expect(res.settings.length).toBe(30);
    expect(server.puts).toHaveLength(0);
    expect(server.stored).toBe(foreign);
  });
});

describe("page de génération", () => {
  async function mountGenerate() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/:lang?", component: Generate }],
    });
    router.push("/fr");
    await router.isReady();
    const wrapper = mount(Generate, { global: { plugins: [router] } });
    await wrapper.vm.$nextTick();
    return wrapper;
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it("reprend les réglages retenus à l'ouverture", async () => {
    saveSettings(settings(28, OLD, { symbols: false }));
    const wrapper = await mountGenerate();

    expect((wrapper.find("#id_longueur").element as HTMLInputElement).value).toBe("28");
    expect(wrapper.vm.symboles).toBe(false);
  });

  it("retient un réglage modifié", async () => {
    const wrapper = await mountGenerate();
    await wrapper.find("#id_longueur").setValue("26");
    await wrapper.vm.$nextTick();

    expect(loadSettings().length).toBe(26);
    expect(loadSettings().updatedAt).not.toBe("");
  });

  it("applique les réglages du compte après le carnet", async () => {
    const server = fakeServer(await encryptFor(settings(14, NEW, { numbers: false }), "clef"));
    vi.stubGlobal("fetch", server.fetchImpl);
    saveSession(SESSION);
    saveSettings(settings(30, OLD));

    const wrapper = await mountGenerate();
    await wrapper.find("#id_clef").setValue("clef");
    const button = wrapper
      .findAll("button")
      .find((b) => b.text().startsWith("Synchroniser maintenant"));
    await button!.trigger("click");

    await vi.waitFor(() => expect(wrapper.vm.longueur).toBe(14), { timeout: 5000 });
    expect(wrapper.vm.chiffres).toBe(false);
    expect(loadSettings()).toStrictEqual(settings(14, NEW, { numbers: false }));
    expect(server.puts).toHaveLength(0);
  });
});
