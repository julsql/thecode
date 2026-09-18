if (typeof browser === "undefined" && typeof chrome !== "undefined") {
  var browser = chrome;
}

// Le carnet vit dans un fichier a part. importScripts fonctionne dans un
// service worker classique, donc sur Chrome, Firefox et Safari ; les modules
// ES ne sont pas supportes partout de la meme facon.
if (typeof importScripts === "function") {
  importScripts("vault.js", "transfer.js", "sync.js");
} else if (typeof require === "function") {
  // Environnement de test : pas de service worker, donc pas d'importScripts.
  // On expose les memes symboles pour tester le cablage reellement livre.
  Object.assign(globalThis, require("./vault.js"), require("./transfer.js"), require("./sync.js"));
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
 * content.js n'utilise que generatePassword et openPopup, donc rien de
 * legitime n'est bloque ici.
 */
const PRIVILEGED_ACTIONS = new Set([
  "getEncodingKey",
  "setEncodingKey",
  "clearEncodingKey",
  "checkEncodingKey",
  "setParams",
  "saveEntry",
  "deleteEntry",
  "syncLogin",
  "syncLogout",
  "syncNow",
  "syncStatus",
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
      const res = await generatePasswordForUrl(request.url || "");
      sendResponse(res);
    } else if (request.action === "getVault") {
      sendResponse({ ok: true, vault: await loadVault(browser?.storage?.local) });
    } else if (request.action === "saveEntry") {
      try {
        const vault = await loadVault(browser?.storage?.local);
        const incoming = request.entry;
        const existing = vault.entries.find((e) => e.id === incoming.id);
        if (existing) {
          // siteKey n'est jamais reecrit : il produit le mot de passe, le
          // modifier en changerait un deja en service.
          Object.assign(existing, incoming, { siteKey: existing.siteKey });
          existing.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
        } else {
          vault.entries.push(incoming);
        }
        await saveVault(browser?.storage?.local, vault);
        sendResponse({ ok: true, vault });
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
      sendResponse({ ok: true, connected: Boolean(session), endpoint: session?.endpoint || "" });
    } else if (request.action === "syncLogin") {
      try {
        const session = await syncLogin(
          request.endpoint || SYNC_DEFAULT_ENDPOINT,
          request.email,
          request.password,
        );
        await saveSession(browser?.storage?.local, session);
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
        await saveSession(browser?.storage?.local, result.session);
        sendResponse({
          ok: true,
          entries: result.vault.entries.filter((e) => !e.deleted).length,
          conflicts: result.conflicts,
        });
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

async function generatePasswordForUrl(url) {
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

    const { mdp, security, bits, color } = await generatePassword(
      domain,
      encodingKey,
      lengthNumber,
      minState,
      majState,
      symState,
      chiState,
    );

    return { password: mdp, site: domain, security, bits, color };
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
