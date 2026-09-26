/**
 * Connexion a la synchronisation avec Google.
 *
 * Le flux passe par browser.identity.launchWebAuthFlow, simule ici : on
 * verifie l'URL demandee a Google, la lecture de la reponse, le state, le
 * corps envoye au service et le cablage du service worker.
 */
const path = require("node:path");
const {
  GoogleAuthError,
  googleAuthUrl,
  parseGoogleRedirect,
  isGoogleCancellation,
  googleSignIn,
  identityApi,
  randomToken,
} = require("../google-auth.js");
const { googleSignInBody } = require("../sync.js");

const REDIRECT = "https://abcdefghijklmnop.chromiumapp.org/";
const ENDPOINT = "https://api.example";

describe("URL d'autorisation", () => {
  const url = new URL(
    googleAuthUrl({ clientId: "web-client", redirectUri: REDIRECT, nonce: "n1", state: "s1" }),
  );

  it("vise le point d'autorisation Google en flux implicite", () => {
    expect(`${url.origin}${url.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("response_type")).toBe("id_token");
    expect(url.searchParams.get("scope")).toBe("openid email");
  });

  it("porte le client, la redirection, le nonce et le state", () => {
    expect(url.searchParams.get("client_id")).toBe("web-client");
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(url.searchParams.get("nonce")).toBe("n1");
    expect(url.searchParams.get("state")).toBe("s1");
  });

  it("tire des valeurs aleatoires distinctes", () => {
    const a = randomToken();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(randomToken()).not.toBe(a);
  });
});

describe("lecture de la redirection", () => {
  it("extrait l'id_token du fragment", () => {
    const redirect = `${REDIRECT}#state=s1&id_token=eyJ.abc.def&authuser=0`;
    expect(parseGoogleRedirect(redirect, "s1")).toBe("eyJ.abc.def");
  });

  it("rejette un state different", () => {
    const redirect = `${REDIRECT}#state=autre&id_token=eyJ.abc.def`;
    expect(() => parseGoogleRedirect(redirect, "s1")).toThrow(
      expect.objectContaining({ code: "state_mismatch" }),
    );
  });

  it("rejette un state absent, meme si aucun n'est attendu", () => {
    expect(() => parseGoogleRedirect(`${REDIRECT}#id_token=x`, "")).toThrow(
      expect.objectContaining({ code: "state_mismatch" }),
    );
  });

  it("signale l'absence de jeton", () => {
    expect(() => parseGoogleRedirect(`${REDIRECT}#state=s1`, "s1")).toThrow(
      expect.objectContaining({ code: "no_token" }),
    );
    expect(() => parseGoogleRedirect("pas une url", "s1")).toThrow(
      expect.objectContaining({ code: "no_token" }),
    );
  });

  it("traite un refus comme une annulation, le reste comme une erreur", () => {
    expect(() => parseGoogleRedirect(`${REDIRECT}#error=access_denied&state=s1`, "s1")).toThrow(
      expect.objectContaining({ code: "cancelled" }),
    );
    expect(() => parseGoogleRedirect(`${REDIRECT}?error=invalid_request`, "s1")).toThrow(
      expect.objectContaining({ code: "google_error" }),
    );
  });

  it("reconnait les annulations de Chrome et de Firefox", () => {
    expect(isGoogleCancellation(new Error("The user did not approve access."))).toBe(true);
    expect(isGoogleCancellation(new Error("User cancelled or denied access."))).toBe(true);
    expect(isGoogleCancellation(new Error("Authorization page could not be loaded."))).toBe(false);
  });
});

describe("corps envoye au service", () => {
  it("transmet l'id_token, le nonce et la langue", () => {
    expect(googleSignInBody("tok", "n1", "fr")).toStrictEqual({
      id_token: "tok",
      nonce: "n1",
      lang: "fr",
      device_label: "extension",
    });
  });

  it("borne la langue a ce que le service accepte", () => {
    expect(googleSignInBody("tok", "n1", "").lang).toBe("en");
    expect(googleSignInBody("tok", "n1", "pt-BR-x").lang).toBe("pt-BR");
  });
});

/** API identity simulee : rend la redirection que `respond` construit. */
function fakeIdentity(respond) {
  const calls = [];
  return {
    calls,
    getRedirectURL: () => REDIRECT,
    launchWebAuthFlow: async (details) => {
      calls.push(details);
      return respond(new URL(details.url).searchParams);
    },
  };
}

describe("googleSignIn", () => {
  it("ouvre la fenetre en interactif et rend le jeton et le nonce", async () => {
    const identity = fakeIdentity((q) => `${REDIRECT}#state=${q.get("state")}&id_token=tok`);
    let n = 0;
    const result = await googleSignIn({ identity, clientId: "web", random: () => `r${++n}` });

    expect(result).toStrictEqual({ idToken: "tok", nonce: "r1" });
    expect(identity.calls[0].interactive).toBe(true);
    expect(new URL(identity.calls[0].url).searchParams.get("state")).toBe("r2");
  });

  it("refuse une reponse dont le state ne correspond pas", async () => {
    const identity = fakeIdentity(() => `${REDIRECT}#state=forge&id_token=tok`);
    await expect(googleSignIn({ identity, clientId: "web" })).rejects.toMatchObject({
      code: "state_mismatch",
    });
  });

  it("rend une annulation quand la fenetre est fermee", async () => {
    const identity = {
      getRedirectURL: () => REDIRECT,
      launchWebAuthFlow: async () => {
        throw new Error("The user did not approve access.");
      },
    };
    await expect(googleSignIn({ identity, clientId: "web" })).rejects.toMatchObject({
      code: "cancelled",
    });
  });

  it("est indisponible sans API identity ni client", async () => {
    expect(identityApi({})).toBeNull();
    await expect(googleSignIn({ identity: null, clientId: "web" })).rejects.toBeInstanceOf(
      GoogleAuthError,
    );
    const identity = fakeIdentity(() => "");
    await expect(googleSignIn({ identity, clientId: "" })).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});

/** Recharge background.js avec identity et un service simules. */
function loadWorker({ identity, googleClientId = "web-client", failRegistration = false } = {}) {
  const store = {};
  const listeners = [];
  const requests = [];

  global.chrome = {
    runtime: {
      getURL: (p) => `chrome-extension://abc/${p}`,
      onMessage: { addListener: (fn) => listeners.push(fn) },
    },
    storage: {
      local: {
        get: async (keys) =>
          Object.fromEntries(
            (Array.isArray(keys) ? keys : [keys])
              .filter((k) => k in store)
              .map((k) => [k, store[k]]),
          ),
        set: async (obj) => Object.assign(store, obj),
        remove: async (keys) =>
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]),
      },
      onChanged: { addListener: () => {} },
    },
    ...(identity ? { identity } : {}),
  };
  global.browser = global.chrome;

  global.fetch = async (url, init = {}) => {
    requests.push({ url, body: init.body ? JSON.parse(init.body) : null });
    const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
    if (url.endsWith("/v1/auth/registration")) {
      if (failRegistration) throw new Error("hors ligne");
      return json(200, { open: true, googleClientId });
    }
    if (url.endsWith("/v1/auth/google")) {
      return json(200, { access_token: "acc", refresh_token: "ref" });
    }
    if (url.endsWith("/v1/auth/me")) return json(200, { plan: "free" });
    return json(404, { detail: "inconnu" });
  };

  jest.resetModules();
  require(path.join(__dirname, "..", "background.js"));

  const send = (request, sender = {}) =>
    new Promise((resolve) => listeners[0](request, sender, resolve));
  return { send, store, requests };
}

describe("service worker", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const okIdentity = () =>
    fakeIdentity((q) => `${REDIRECT}#state=${q.get("state")}&id_token=tok-google`);

  it("reserve la connexion Google aux pages de l'extension", async () => {
    const { send } = loadWorker({ identity: okIdentity() });
    const fromPage = { tab: { id: 4 }, url: "https://evil.example/" };
    for (const action of ["syncGoogleLogin", "syncGoogleAvailable"]) {
      expect(await send({ action, endpoint: ENDPOINT }, fromPage)).toStrictEqual({
        error: "action reservee a l'extension",
      });
    }
  });

  it("propose Google seulement avec l'API identity et un client publie", async () => {
    expect(
      (
        await loadWorker({ identity: okIdentity() }).send({
          action: "syncGoogleAvailable",
          endpoint: ENDPOINT,
        })
      ).available,
    ).toBe(true);
    expect(
      (await loadWorker().send({ action: "syncGoogleAvailable", endpoint: ENDPOINT })).available,
    ).toBe(false);
    expect(
      (
        await loadWorker({ identity: okIdentity(), googleClientId: null }).send({
          action: "syncGoogleAvailable",
          endpoint: ENDPOINT,
        })
      ).available,
    ).toBe(false);
    expect(
      (
        await loadWorker({ identity: okIdentity(), failRegistration: true }).send({
          action: "syncGoogleAvailable",
          endpoint: ENDPOINT,
        })
      ).available,
    ).toBe(false);
  });

  it("echange le jeton et enregistre la session comme la connexion par mot de passe", async () => {
    const identity = okIdentity();
    const { send, store, requests } = loadWorker({ identity });

    expect(await send({ action: "syncGoogleLogin", endpoint: ENDPOINT, lang: "fr" })).toStrictEqual(
      { ok: true },
    );

    const sentNonce = new URL(identity.calls[0].url).searchParams.get("nonce");
    const google = requests.find((r) => r.url === `${ENDPOINT}/v1/auth/google`);
    expect(google.body).toStrictEqual({
      id_token: "tok-google",
      nonce: sentNonce,
      lang: "fr",
      device_label: "extension",
    });
    expect(store.syncSession).toStrictEqual({
      endpoint: ENDPOINT,
      accessToken: "acc",
      refreshToken: "ref",
      plan: "free",
    });
    expect((await send({ action: "syncStatus" })).connected).toBe(true);
  });

  it("se tait sur une annulation et n'ecrit rien", async () => {
    const identity = {
      getRedirectURL: () => REDIRECT,
      launchWebAuthFlow: async () => {
        throw new Error("User cancelled or denied access.");
      },
    };
    const { send, store } = loadWorker({ identity });
    expect(await send({ action: "syncGoogleLogin", endpoint: ENDPOINT })).toStrictEqual({
      ok: false,
      cancelled: true,
    });
    expect(store.syncSession).toBeUndefined();
  });

  it("rend un code traduisible sans API identity", async () => {
    const { send } = loadWorker();
    expect(await send({ action: "syncGoogleLogin", endpoint: ENDPOINT })).toMatchObject({
      ok: false,
      code: "unavailable",
    });
  });
});
