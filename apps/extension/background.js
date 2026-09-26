if (typeof browser === "undefined" && typeof chrome !== "undefined") {
  var browser = chrome;
}

// Le carnet vit dans un fichier a part. Chrome charge le fond en service
// worker : importScripts y tire les dependances. Firefox et Safari le chargent
// en page de fond, sans importScripts : c'est leur manifeste qui liste ces
// fichiers avant celui-ci (voir manifest.spec.js).
if (typeof importScripts === "function") {
  importScripts("vault.js", "transfer.js", "sync.js", "core-v2.js", "vault-lock.js");
}
// En test, core-v2.js est charge en fin de fichier : il require background.js,
// et le faire ici rendrait des exports encore vides.
else if (typeof require === "function") {
  // Environnement de test : pas de service worker, donc pas d'importScripts.
  // On expose les memes symboles pour tester le cablage reellement livre.
  Object.assign(
    globalThis,
    require("./vault.js"),
    require("./transfer.js"),
    require("./sync.js"),
    require("./vault-lock.js"),
  );
}

let psl = [];

// Promise réutilisable : on attendra son résolution avant d'utiliser `psl`,
// pour qu'un appel à getRegistrableDomain pendant le chargement ne tombe
// jamais sur une liste vide.
// Hors contexte d'extension (suite de tests Node), il n'y a pas de
// `browser.runtime` : on résout immédiatement plutôt que de faire échouer le
// chargement du module, pour que les fonctions pures restent testables.
const pslReady = browser?.runtime?.getURL
  ? fetch(browser.runtime.getURL("data/public_suffix_list.dat"))
      .then((r) => r.text())
      .then((t) => {
        psl = t
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("//"));
      })
      .catch((err) => {
        console.error("TheCode: échec du chargement de la PSL", err);
      })
  : Promise.resolve();

// Bornes et valeurs par défaut des paramètres de génération, partagées avec
// la popup (cf. popup.js) et alignées sur les apps natives.
const MIN_LENGTH = 4;
const MAX_LENGTH = 40;
const DEFAULT_PARAMS = {
  lengthNumber: 20,
  minState: true,
  majState: true,
  symState: true,
  chiState: true,
};

// La clé reste volontairement en mémoire seule : elle disparaît avec le
// service worker et n'est jamais écrite sur disque.
let encodingKey = null;

// Les paramètres, eux, DOIVENT survivre au recyclage du service worker MV3 :
// sinon une longueur réglée à 30 dans la popup retombait à 20 dès que le
// worker était déchargé, et le menu injecté dans la page (content.js, qui
// n'envoie pas d'options) générait un mot de passe avec la mauvaise longueur.
// `browser.storage.local` est donc la source de vérité ; `params` n'en est
// qu'un cache local, réhydraté au démarrage et sur chaque changement.
let params = { ...DEFAULT_PARAMS };

function clampLength(value) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return DEFAULT_PARAMS.lengthNumber;
  return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, n));
}

/// Normalise ce qui sort du stockage : anciennes clés (`length`,
/// `lenghtNumber`) incluses, pour ne pas perdre les réglages déjà enregistrés
/// par une version précédente de l'extension.
function normalizeParams(raw = {}) {
  const rawLength = raw.lengthNumber ?? raw.lenghtNumber ?? raw.length;
  return {
    lengthNumber: rawLength === undefined ? DEFAULT_PARAMS.lengthNumber : clampLength(rawLength),
    minState: raw.minState ?? DEFAULT_PARAMS.minState,
    majState: raw.majState ?? DEFAULT_PARAMS.majState,
    symState: raw.symState ?? DEFAULT_PARAMS.symState,
    chiState: raw.chiState ?? DEFAULT_PARAMS.chiState,
  };
}

/// Relit les paramètres depuis le stockage. Appelé avant chaque génération :
/// c'est ce qui garantit qu'un réglage modifié dans la popup s'applique
/// immédiatement, y compris après un redémarrage du service worker.
async function loadParams() {
  const store = browser?.storage?.local;
  if (!store) return params;
  try {
    const stored = await store.get([
      "lengthNumber",
      "lenghtNumber",
      "length",
      "minState",
      "majState",
      "symState",
      "chiState",
    ]);
    params = normalizeParams(stored);
  } catch (e) {
    console.error("TheCode: échec de la lecture des paramètres", e);
  }
  return params;
}

async function saveParams(next) {
  // La rehydratation lancee au demarrage du worker n'est pas attendue : sans
  // ce point de rendez-vous, un reglage enregistre juste apres le demarrage
  // etait ecrase par loadParams() qui se terminait ensuite, et la valeur
  // retombait silencieusement sur celle du stockage.
  await paramsReady;
  params = normalizeParams(next);
  const store = browser?.storage?.local;
  if (!store) return params;
  try {
    await store.set(params);
    // Nettoie les clés héritées pour ne plus jamais les relire.
    await store.remove(["lenghtNumber", "length"]);
  } catch (e) {
    console.error("TheCode: échec de l'écriture des paramètres", e);
  }
  return params;
}

// Réhydratation au (re)démarrage du worker + suivi des changements, pour que
// deux popups ou fenêtres ouvertes restent cohérentes. La promesse est
// conservee : saveParams() l'attend pour ne pas se faire ecraser.
const paramsReady = loadParams();
browser?.storage?.onChanged?.addListener((changes, area) => {
  if (area !== "local") return;
  const touched = Object.keys(changes).some(
    (k) => k in DEFAULT_PARAMS || k === "lenghtNumber" || k === "length",
  );
  if (touched) loadParams();
});

/**
 * Actions reservees aux pages de l'extension (la popup).
 *
 * content.js est injecte dans <all_urls> : sans ce filtre, n'importe quel
 * content script pouvait demander la cle maitresse au service worker via
 * getEncodingKey. Les pages de l'extension envoient leurs messages sans onglet
 * associe (sender.tab est undefined), un content script en a toujours un.
 *
 * content.js n'utilise que generatePassword, saveCurrentSite et openPopup,
 * donc rien de legitime n'est bloque ici. getVault en fait partie : le carnet
 * liste les sites et identifiants de l'utilisateur, une page n'a pas a le lire.
 */
const PRIVILEGED_ACTIONS = new Set([
  "getEncodingKey",
  "setEncodingKey",
  "clearEncodingKey",
  "checkEncodingKey",
  "setParams",
  "getVault",
  "saveSite",
  "deleteEntry",
  "previewChange",
  "applyChange",
  "exportVault",
  "importVault",
  "syncLogin",
  "syncLogout",
  "syncNow",
  "syncStatus",
  "vaultLockStatus",
  "vaultLockCreate",
  "vaultLockVerify",
  "vaultLockChange",
  "vaultLockForget",
]);

function isFromExtensionPage(sender) {
  if (!sender) return true;

  // Ce qui compte est l'origine, pas la presence d'un onglet. Quand
  // browser.action.openPopup() n'existe pas — Firefox pour Android, Safari —
  // la popup est ouverte dans un onglet : elle a donc un sender.tab tout en
  // etant une page de l'extension. Se fier au seul sender.tab lui refusait
  // jusqu'a l'enregistrement de la clef.
  const base = browser?.runtime?.getURL ? browser.runtime.getURL("") : "";
  if (base && typeof sender.url === "string" && sender.url.startsWith(base)) {
    return true;
  }

  return sender.tab === undefined;
}

/**
 * Le renouvellement demande l'offre complete.
 *
 * Verifie ici, dans le service worker, et pas seulement dans la popup :
 * celle-ci ne fait qu'afficher, et c'est ici que le compteur s'ecrit.
 *
 * Decide sur l'appareil, forcement : le compteur voyage a l'interieur du bloc
 * chiffre, le serveur ne le voit pas et ne peut donc rien en dire.
 */
async function renewAllowed() {
  const session = await loadSession(browser?.storage?.local);
  return isPaidPlan(session?.plan);
}

const RENEW_IS_PAID =
  "Renouveler un mot de passe sans changer de clef maitresse fait partie de " +
  "l'offre complete : https://thecode.julsql.fr/fr/account";

browser?.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    if (PRIVILEGED_ACTIONS.has(request.action) && !isFromExtensionPage(sender)) {
      sendResponse({ error: "action reservee a l'extension" });
      return;
    }
    if (request.action === "checkEncodingKey") {
      sendResponse({ hasEncodingKey: !!encodingKey });
    } else if (request.action === "getEncodingKey") {
      sendResponse({ encodingKey });
    } else if (request.action === "setEncodingKey") {
      try {
        encodingKey = request.encodingKey;
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    } else if (request.action === "getParams") {
      sendResponse({ ok: true, params: await loadParams() });
    } else if (request.action === "setParams") {
      try {
        sendResponse({ ok: true, params: await saveParams(request.data) });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    } else if (request.action === "clearEncodingKey") {
      encodingKey = null;
      sendResponse({ ok: true });
    } else if (request.action === "generatePassword") {
      // Seule la popup demande la v1 ou un identifiant : content.js n'envoie
      // ni l'un ni l'autre et garde le comportement d'origine.
      const res = await generatePasswordForUrl(request.url || "", request.version, request.login);
      sendResponse(res);
    } else if (request.action === "getVault") {
      sendResponse({ ok: true, vault: await loadVault(browser?.storage?.local) });
    } else if (request.action === "saveSite") {
      try {
        sendResponse(await saveSite(request.domain, request.login));
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    } else if (request.action === "saveCurrentSite") {
      try {
        sendResponse(await saveCurrentSite(sender, request.login));
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    } else if (request.action === "exportVault") {
      // Le chiffrement se fait ici : la clef maitresse ne descend jamais
      // jusqu'a la page de transfert.
      try {
        sendResponse(await exportVaultPayload());
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    } else if (request.action === "importVault") {
      try {
        sendResponse(await importVaultPayload(request.payload));
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    } else if (request.action === "previewChange") {
      // Renouvellement seulement : il n'y a plus d'entree v1 a migrer.
      // Calcule sans rien ecrire : l'ancien mot de passe est encore celui du
      // site tant qu'il n'y a pas ete change.
      try {
        const vault = await loadVault(browser?.storage?.local);
        const entry = vault.entries.find((e) => e.id === request.id && !e.deleted);
        if (!entry) {
          sendResponse({ ok: false, error: "entree introuvable" });
        } else if (!encodingKey) {
          sendResponse({ ok: false, error: "aucune clef definie" });
        } else if (!(await renewAllowed())) {
          sendResponse({ ok: false, error: RENEW_IS_PAID });
        } else {
          sendResponse({
            ok: true,
            before: await passwordForEntry(entry),
            after: await passwordForEntry(entry, entry.counter + 1),
          });
        }
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    } else if (request.action === "applyChange") {
      try {
        const vault = await loadVault(browser?.storage?.local);
        const entry = vault.entries.find((e) => e.id === request.id && !e.deleted);
        if (!entry) {
          sendResponse({ ok: false, error: "entree introuvable" });
        } else if (!(await renewAllowed())) {
          sendResponse({ ok: false, error: RENEW_IS_PAID });
        } else {
          entry.counter += 1;
          // Sans rehorodatage, la fusion ferait gagner l'autre appareil et le
          // changement serait perdu a la synchronisation suivante.
          entry.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
          await saveVault(browser?.storage?.local, vault);
          sendResponse({ ok: true, counter: entry.counter });
        }
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    } else if (request.action === "deleteEntry") {
      try {
        const vault = await loadVault(browser?.storage?.local);
        const entry = vault.entries.find((e) => e.id === request.id);
        if (entry) {
          // Pierre tombale plutot que suppression : sinon la suppression
          // serait annulee a la prochaine fusion.
          entry.deleted = true;
          entry.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
          await saveVault(browser?.storage?.local, vault);
        }
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    } else if (request.action === "syncStatus") {
      const session = await loadSession(browser?.storage?.local);
      sendResponse({
        ok: true,
        connected: Boolean(session),
        endpoint: session?.endpoint || "",
        canRenew: isPaidPlan(session?.plan),
      });
    } else if (request.action === "syncLogin") {
      try {
        const session = await syncLogin(
          request.endpoint || SYNC_DEFAULT_ENDPOINT,
          request.email,
          request.password,
        );
        const withPlan = await syncAccountPlan(session);
        await saveSession(browser?.storage?.local, {
          ...withPlan.session,
          plan: withPlan.plan,
        });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    } else if (request.action === "syncLogout") {
      await clearSession(browser?.storage?.local);
      sendResponse({ ok: true });
    } else if (request.action === "syncNow") {
      // La clef maitresse ne quitte pas le service worker : la popup demande
      // la synchronisation, elle ne la fait pas elle-meme.
      if (!encodingKey) {
        sendResponse({ ok: false, error: "Aucune clef definie." });
        return;
      }
      const session = await loadSession(browser?.storage?.local);
      if (!session) {
        sendResponse({ ok: false, error: "Aucune session. Connectez-vous d'abord." });
        return;
      }
      try {
        const vault = await loadVault(browser?.storage?.local);
        const result = await syncVault(vault, encodingKey, session);
        await saveVault(browser?.storage?.local, result.vault);
        // Un abonnement pris entre-temps doit se voir sans se reconnecter.
        const withPlan = await syncAccountPlan(result.session);
        await saveSession(browser?.storage?.local, {
          ...withPlan.session,
          plan: withPlan.plan,
        });
        sendResponse({
          ok: true,
          entries: result.vault.entries.filter((e) => !e.deleted).length - result.localOnly,
          localOnly: result.localOnly,
          conflicts: result.conflicts,
        });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    } else if (VAULT_LOCK_ACTIONS.has(request.action)) {
      try {
        sendResponse(await handleVaultLock(request));
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    } else if (request.action === "openPopup") {
      try {
        if (browser.action && typeof browser.action.openPopup === "function") {
          await browser.action.openPopup();
          sendResponse({ ok: true });
        } else {
          await browser.tabs.create({ url: browser.runtime.getURL("popup.html") });
          sendResponse({ ok: true, fallback: "tab" });
        }
      } catch (e) {
        try {
          await browser.tabs.create({ url: browser.runtime.getURL("popup.html") });
          sendResponse({ ok: true, fallback: "tab" });
        } catch (err) {
          sendResponse({ ok: false, error: err.message });
        }
      }
    } else {
      sendResponse({ error: "action inconnue" });
    }
  })();
  return true;
});

// Code

/**
 * Derive le mot de passe d'une entree.
 *
 * Une entree derive en v2. `version` vaut 1 seulement quand
 * la popup demande l'ancien algorithme, en secours pour un site dont le mot de
 * passe n'a pas encore ete change : la v1 n'existe plus qu'hors carnet.
 */
async function passwordForEntry(entry, counter, version = 2) {
  if (version !== 1) {
    return generatePasswordV2(entry.siteKey, encodingKey, entry.length, {
      useLower: entry.charset.lower,
      useUpper: entry.charset.upper,
      useSymbols: entry.charset.symbols,
      useNumbers: entry.charset.numbers,
      login: entry.login || "",
      counter: counter ?? entry.counter,
    });
  }
  // v1 : ni login ni compteur n'entrent dans la derivation.
  const { mdp } = await generatePassword(
    entry.siteKey,
    encodingKey,
    entry.length,
    entry.charset.lower,
    entry.charset.upper,
    entry.charset.symbols,
    entry.charset.numbers,
  );
  return mdp;
}

/**
 * Identifiant tel qu'il entre dans la derivation.
 *
 * Sans les espaces autour. `undefined` quand l'appelant n'en envoie pas (content.js) : on garde alors
 * la premiere entree du domaine, comme avant. Borne : il est hache, mais un
 * message peut contenir n'importe quoi.
 */
function normalizeLogin(login) {
  // Les espaces autour ne comptent pas, comme sur les apps et le site.
  return typeof login === "string" ? login.trim().slice(0, VAULT_LOGIN_MAX) : undefined;
}

/**
 * Enregistre le compte affiche dans la popup : domaine + identifiant.
 *
 * Une entree existante ne voit changer que sa longueur et son jeu de
 * caracteres, relus des parametres ; sinon une entree v2 nait. Rien ici ne
 * peut produire une entree v1, meme quand la popup est reglee en v1.
 */
async function saveSite(domain, login) {
  if (typeof domain !== "string" || !domain.trim()) {
    return { ok: false, error: "aucun site detecte" };
  }
  const { lengthNumber, minState, majState, symState, chiState } = await loadParams();
  const vault = await loadVault(browser?.storage?.local);
  const { entry, updated } = upsertSiteEntry(vault, {
    domain: domain.trim().toLowerCase(),
    login: normalizeLogin(login) ?? "",
    length: lengthNumber,
    charset: { lower: minState, upper: majState, symbols: symState, numbers: chiState },
  });
  await saveVault(browser?.storage?.local, vault);
  return { ok: true, updated, entry };
}

/**
 * Enregistre le site de l'onglet courant dans le carnet.
 *
 * Seule ecriture du carnet ouverte a un script de page, et volontairement
 * etroite : le domaine vient de `sender.tab.url`, jamais du message. Une page
 * hostile ne peut donc pas faire enregistrer une entree pour un autre site
 * qu'elle-meme — ce qui ne lui apporterait rien, et demande de toute facon un
 * clic de l'utilisateur.
 *
 * Le login, lui, vient de la page : c'est le champ que l'utilisateur vient de
 * remplir. Il est borne, et affiche avant confirmation.
 */
async function saveCurrentSite(sender, login) {
  const url = sender?.tab?.url;
  if (!url) return { ok: false, error: "aucun onglet" };
  if (!encodingKey) return { ok: false, error: "aucune clef definie" };

  await pslReady;
  let domain;
  try {
    domain = getRegistrableDomain(new URL(url).hostname);
  } catch {
    return { ok: false, error: "adresse illisible" };
  }
  if (!domain) return { ok: false, error: "domaine illisible" };

  const vault = await loadVault(browser?.storage?.local);
  const existing = findAllByDomain(vault, domain)[0];
  const { lengthNumber, minState, majState, symState, chiState } = await loadParams();
  const charset = {
    lower: minState,
    upper: majState,
    symbols: symState,
    numbers: chiState,
  };

  if (existing) {
    // siteKey n'est jamais reecrit : il produit le mot de passe, le modifier
    // en changerait un deja en service.
    existing.length = lengthNumber;
    existing.charset = charset;
    existing.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    await saveVault(browser?.storage?.local, vault);
    return { ok: true, updated: true, site: domain };
  }

  vault.entries.push(
    newEntry(domain, {
      domains: [domain],
      length: lengthNumber,
      charset,
      // Borne : un champ de page peut contenir n'importe quoi.
      login: normalizeLogin(login) ?? "",
    }),
  );
  await saveVault(browser?.storage?.local, vault);
  return { ok: true, updated: false, site: domain };
}

const VAULT_LOCK_ACTIONS = new Set([
  "vaultLockStatus",
  "vaultLockCreate",
  "vaultLockVerify",
  "vaultLockChange",
  "vaultLockForget",
]);

/**
 * Verrou de l'ecran carnet (shared/spec/vault-lock.md).
 *
 * Verifie ici plutot que dans la page : l'empreinte stockee ne transite pas
 * jusqu'a elle. L'etat deverrouille, lui, ne vit que dans la page — rien n'est
 * memorise ici, fermer l'onglet reverrouille.
 */
async function handleVaultLock(request) {
  const store = browser?.storage?.local;
  const record = await loadVaultLock(store);

  switch (request.action) {
    case "vaultLockStatus":
      return { ok: true, configured: Boolean(record) };

    case "vaultLockCreate": {
      // Une fois pose, le verrou ne se remplace qu'avec l'actuel ou en
      // effacant le carnet : sinon n'importe quelle page de l'extension
      // pourrait le reinitialiser.
      if (record) return { ok: false, error: "un mot de passe de carnet existe deja" };
      const weak = vaultLockPasswordError(request.password);
      if (weak) return { ok: false, error: weak };
      await saveVaultLock(store, await hashVaultPassword(request.password));
      return { ok: true };
    }

    case "vaultLockVerify":
      return { ok: true, unlocked: await verifyVaultPassword(request.password, record) };

    case "vaultLockChange": {
      if (!(await verifyVaultPassword(request.current, record))) {
        return { ok: false, error: "mot de passe actuel incorrect" };
      }
      const weak = vaultLockPasswordError(request.next);
      if (weak) return { ok: false, error: weak };
      await saveVaultLock(store, await hashVaultPassword(request.next));
      return { ok: true };
    }

    case "vaultLockForget":
      // Seule issue sans le mot de passe : le carnet local part avec le
      // verrou. La synchronisation le rapportera s'il existe sur le serveur.
      await store.remove([VAULT_STORAGE_KEY]);
      await clearVaultLock(store);
      return { ok: true };
  }
  return { ok: false, error: "action inconnue" };
}

/** Chiffre le carnet courant. Rend la meme forme que l'action du meme nom. */
async function exportVaultPayload() {
  const vault = await loadVault(browser?.storage?.local);
  if (!encodingKey) return { ok: false, error: "aucune clef definie" };
  if (!vault.entries.filter((e) => !e.deleted).length) {
    return { ok: false, error: "le carnet est vide" };
  }
  return { ok: true, payload: await exportVault(vault, encodingKey) };
}

/** Fusionne un payload avec le carnet local. */
async function importVaultPayload(payload) {
  if (!encodingKey) return { ok: false, error: "aucune clef definie" };
  const incoming = await importVault(payload, encodingKey);
  // Fusion et jamais substitution : un import qui ecraserait effacerait les
  // entrees creees ici.
  const { vault, conflicts } = mergeVaults(await loadVault(browser?.storage?.local), incoming);
  await saveVault(browser?.storage?.local, vault);
  return {
    ok: true,
    entries: vault.entries.filter((e) => !e.deleted).length,
    conflicts: conflicts.length,
  };
}

/** Pose la clef en test : elle n'est jamais exposee autrement. */
function setEncodingKeyForTests(key) {
  encodingKey = key;
}

/**
 * `version` vaut 2 par defaut : c'est ce que rend le remplissage automatique.
 * La popup peut demander la v1, en secours pour un site pas encore migre ;
 * toute autre valeur retombe sur la v2.
 *
 * `login` vient de la popup, ou l'utilisateur le saisit. Absent (content.js),
 * on retient la premiere entree du domaine, comme avant. Present, il designe
 * le compte — domaine + identifiant — et entre dans la derivation v2 ; vide,
 * il ne change rien au calcul. La v1 l'ignore.
 */
async function generatePasswordForUrl(url, version, login) {
  const v = version === 1 ? 1 : 2;
  const requestedLogin = normalizeLogin(login);
  if (!encodingKey) {
    return { error: "Aucune clé n'est définie. Ouvre l'extension TheCode et entre ta clé." };
  }
  // Relecture systématique : le service worker peut avoir été recyclé depuis
  // le dernier réglage, et content.js n'envoie aucune option.
  const { lengthNumber, minState, majState, symState, chiState } = await loadParams();

  if (!minState && !majState && !symState && !chiState) {
    return { error: "Il faut choisir des caractères" };
  }
  try {
    await pslReady;
    const u = new URL(url);
    const hostname = u.hostname;
    const domain = getRegistrableDomain(hostname);

    // Le carnet dit sous quelle clef deriver et avec quels reglages. Le
    // domaine saisi peut etre un alias — google.fr doit rendre le mot de passe
    // de google.com.
    const vault = await loadVault(browser?.storage?.local);
    const entry =
      requestedLogin === undefined
        ? findAllByDomain(vault, domain)[0]
        : findByDomainAndLogin(vault, domain, requestedLogin);

    if (!entry) {
      // Site inconnu : v2 par defaut aussi, c'est la version des entrees qui
      // naissent.
      const {
        mdp: v1Password,
        security,
        bits,
        color,
      } = await generatePassword(
        domain,
        encodingKey,
        lengthNumber,
        minState,
        majState,
        symState,
        chiState,
      );
      const mdp =
        v === 1
          ? v1Password
          : await generatePasswordV2(domain, encodingKey, lengthNumber, {
              useLower: minState,
              useUpper: majState,
              useSymbols: symState,
              useNumbers: chiState,
              login: requestedLogin || "",
            });
      return {
        password: mdp,
        site: domain,
        login: requestedLogin || "",
        security,
        bits,
        color,
        known: false,
        version: v,
      };
    }

    const { security, bits, color } = await generatePassword(
      entry.siteKey,
      encodingKey,
      entry.length,
      entry.charset.lower,
      entry.charset.upper,
      entry.charset.symbols,
      entry.charset.numbers,
    );

    // Les entrees sont toutes v2. La v1 ne se derive que sur demande de la
    // popup, pour un site dont le mot de passe n'a pas encore ete change.
    const mdp = await passwordForEntry(entry, entry.counter, v);

    return {
      password: mdp,
      site: domain,
      login: entry.login || "",
      entryId: entry.id,
      security,
      bits,
      color,
      known: true,
      version: v,
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Domaine enregistrable d'un hostname, d'apres une liste de suffixes publics.
 *
 * Fonction pure : la liste est passee en argument, ce qui la rend testable sans
 * dependre du chargement asynchrone de la PSL. Le wrapper ci-dessous utilise la
 * liste du service worker.
 */
function registrableDomain(hostname, suffixes) {
  const p = String(hostname).toLowerCase().split(".");

  for (let i = 0; i < p.length; i++) {
    const candidate = p.slice(i).join(".");
    if (suffixes.includes(candidate)) {
      // i === 0 : le hostname EST un suffixe public (github.io, co.uk). On ne
      // peut pas remonter d'un cran ; p.slice(-1) renvoyait le TLD seul ("io"),
      // ce qui divergeait d'Apple et d'Android. On rend le hostname tel quel.
      if (i === 0) return p.join(".");
      return p.slice(i - 1).join(".");
    }
  }
  return p.join(".");
}

function getRegistrableDomain(hostname) {
  return registrableDomain(hostname, psl);
}

/**
 * Génère un mot de passe déterministe basé sur site + clef
 * et renvoie des informations de sécurité.
 */
async function generatePassword(site, key, length, useLower, useUpper, useSymbols, useNumbers) {
  const charsetGroups = buildCharset(useLower, useUpper, useSymbols, useNumbers);
  if (charsetGroups.length === 0 || (!site && !key)) {
    return buildPasswordResult(null, "Aucune", 0, "#FE0101");
  }
  // Garde-fou : la longueur est bornée ici aussi, pour que la fonction reste
  // sûre quel que soit son appelant (popup, content script, tests).
  const newLength = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, parseInt(length, 10) || MIN_LENGTH));

  const entropyBits = calculateEntropyBits(charsetGroups, newLength);
  const securityInfo = getSecurityLevel(entropyBits);

  const passwordSeed = await hashToBigInt(site + key);
  const rawPassword = convertToBase(passwordSeed, charsetGroups);
  const finalPassword = applyCharsetReplacement(
    passwordSeed,
    rawPassword.slice(0, newLength),
    charsetGroups,
  );

  return buildPasswordResult(finalPassword, securityInfo.security, entropyBits, securityInfo.color);
}

/** ===================== */
/**        HELPERS        */
/** ===================== */

/**
 * Construit le résultat final d'un mot de passe.
 */
function buildPasswordResult(password, security, bits, color) {
  return { mdp: password, security, bits, color };
}

/**
 * Construit la base de caractères en fonction des options.
 */
function buildCharset(useLower, useUpper, useSymbols, useNumbers) {
  const lower = "portezcviuxwhskyajgblndqfm";
  const upper = "THEQUICKBROWNFXJMPSVLAZYDG";
  const symbols = "@#&!)-%;<:*$+=/?>(";
  const numbers = "567438921";

  return [
    useLower ? lower : "",
    useUpper ? upper : "",
    useSymbols ? symbols : "",
    useNumbers ? numbers : "",
  ].filter(Boolean);
}

/**
 * Calcule le nombre de bits d'entropie pour la longueur et la base données.
 */
function calculateEntropyBits(charsetGroups, length) {
  const totalChars = charsetGroups.reduce((sum, group) => sum + group.length, 0);
  if (totalChars === 0) return 0;

  return Math.round(length * Math.log2(totalChars));
}

/**
 * Détermine le niveau de sécurité en fonction des bits d'entropie.
 */
function getSecurityLevel(bits) {
  if (bits === 0) return { security: "Aucune", color: "#FE0101" };
  if (bits < 64) return { security: "Très Faible", color: "#FE0101" };
  if (bits < 80) return { security: "Faible", color: "#FE4501" };
  if (bits < 100) return { security: "Moyenne", color: "#FE7601" };
  if (bits < 126) return { security: "Forte", color: "#53FE38" };
  return { security: "Très Forte", color: "#1CD001" };
}

/**
 * Transforme une valeur en BigInt en une chaîne dans la base construite.
 */
function convertToBase(x, charsetGroups) {
  const charset = charsetGroups.join("");
  const base = BigInt(charset.length);

  let value = BigInt(x);
  let result = "";
  while (value >= 0) {
    const index = Number(value % base);
    result = charset.charAt(index) + result;
    value = value / base - 1n;
    if (value < 0) break;
  }
  return result;
}

/**
 * Remplace certains caractères du mot de passe pour garantir
 * qu'au moins un caractère de chaque groupe est présent.
 */
function applyCharsetReplacement(seed, password, charsetGroups) {
  const length = password.length;
  if (length < charsetGroups.length) {
    throw new Error(`Password must have at least ${charsetGroups.length} characters`);
  }

  let temp = seed;
  const positions = [];

  // Sélection des positions uniques
  for (let i = 0; i < charsetGroups.length; i++) {
    const pos = getUniquePosition(temp, positions, length);
    positions.push(pos);
    temp /= BigInt(length);
  }

  // Remplacement des caractères
  let result = password;
  temp = seed;
  positions.forEach((pos, i) => {
    const group = charsetGroups[i];
    const index = Number(temp % BigInt(group.length));
    result = result.slice(0, pos) + group[index] + result.slice(pos + 1);
    temp /= BigInt(group.length);
  });

  return result;
}

/**
 * Retourne une position unique non utilisée dans le tableau `usedPositions`.
 */
function getUniquePosition(seed, usedPositions, length) {
  let pos = Number(seed % BigInt(length));
  while (usedPositions.includes(pos)) {
    pos = (pos + 1) % length;
  }
  return pos;
}

/**
 * Renvoie le SHA-256 sous forme de BigInt.
 */
async function hashToBigInt(input) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return BigInt("0x" + hex);
}

if (typeof module !== "undefined") {
  module.exports = {
    generatePassword,
    generatePasswordForUrl,
    passwordForEntry,
    saveSite,
    normalizeLogin,
    exportVaultPayload,
    importVaultPayload,
    saveCurrentSite,
    setEncodingKeyForTests,
    getRegistrableDomain,
    registrableDomain,
    PRIVILEGED_ACTIONS,
    isFromExtensionPage,
    buildCharset,
    calculateEntropyBits,
    getSecurityLevel,
    convertToBase,
    applyCharsetReplacement,
    getUniquePosition,
    hashToBigInt,
    normalizeParams,
    clampLength,
    MIN_LENGTH,
    MAX_LENGTH,
    DEFAULT_PARAMS,
  };
}

// Charge apres module.exports : core-v2.js require ce fichier pour le rendu
// (convertToBase, applyCharsetReplacement), et l'inverse donnerait un require
// circulaire aux exports incomplets.
if (typeof importScripts !== "function" && typeof require === "function") {
  Object.assign(globalThis, require("./core-v2.js"));
}
