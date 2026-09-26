/**
 * Message traduit selon la langue du navigateur. Le francais reste en secours
 * quand l'API manque (tests) ou que la clef n'existe pas. `values` remplit
 * $1, $2… dans l'ordre.
 */
function msg(key, fallback, ...values) {
  const subs = values.map(String);
  const text = browser.i18n?.getMessage(key, subs.length ? subs : undefined);
  return text || subs.reduce((out, v, i) => out.replace(`$${i + 1}`, v), fallback);
}

/**
 * Traduit la page d'apres ses attributs data-i18n*. Le francais du HTML reste
 * en place pour toute clef absente.
 */
function translatePage() {
  document.documentElement.lang = browser.i18n?.getUILanguage?.().split("-")[0] || "fr";
  const attributes = {
    i18n: null,
    i18nAriaLabel: "aria-label",
    i18nTitle: "title",
    i18nHref: "href",
  };
  for (const [data, attribute] of Object.entries(attributes)) {
    const selector = `[data-${data.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`;
    document.querySelectorAll(selector).forEach((el) => {
      const text = browser.i18n?.getMessage(el.dataset[data]);
      if (!text) return;
      if (attribute) el.setAttribute(attribute, text);
      else el.textContent = text;
    });
  }
}
translatePage();

// Références aux éléments de la popup
const passInput = document.getElementById("passphrase");
const setBtn = document.getElementById("setKey");
const clearBtn = document.getElementById("clearKey");
const toggleBtn = document.getElementById("toggleKey");
const statusDiv = document.getElementById("status");
const generateBtn = document.getElementById("generatePassword");
const site = document.getElementById("site");
const passwordResult = document.getElementById("passwordResult");
const passwordSecurity = document.getElementById("passwordSecurity");
const error = document.getElementById("error");
const resultBox = document.getElementById("result");
const copyStatus = document.getElementById("copyStatus");
const errorContainer = document.getElementById("errorContainer");
const fingerprintRow = document.getElementById("fingerprintRow");
const fingerprintChip = document.getElementById("fingerprint");
const loginInput = document.getElementById("login");
const loginOptions = document.getElementById("loginOptions");
const saveEntryBtn = document.getElementById("saveEntry");
const vaultStatus = document.getElementById("vaultStatus");
const changeEntryBtn = document.getElementById("changeEntry");
const changePreview = document.getElementById("changePreview");
const changeBefore = document.getElementById("changeBefore");
const changeAfter = document.getElementById("changeAfter");
const changeConfirmBtn = document.getElementById("changeConfirm");
const changeCancelBtn = document.getElementById("changeCancel");

/** Entree visee par le changement en cours, et son sens. */
let pendingChange = null;
const syncLoggedOut = document.getElementById("syncLoggedOut");
const syncLoggedIn = document.getElementById("syncLoggedIn");
const syncEmail = document.getElementById("syncEmail");
const syncPassword = document.getElementById("syncPassword");
const syncLoginBtn = document.getElementById("syncLoginBtn");
const syncNowBtn = document.getElementById("syncNowBtn");
const syncLogoutBtn = document.getElementById("syncLogoutBtn");
const syncStatus = document.getElementById("syncStatus");
const renewPitch = document.getElementById("renewPitch");

const lengthInput = document.getElementById("length");
// Bornes lues sur le champ lui-même, pour ne pas les redéclarer ici en plus
// du HTML et du background (qui reste l'autorité : il borne ce qu'on envoie).
const MIN_LENGTH = parseInt(lengthInput.min, 10);
const MAX_LENGTH = parseInt(lengthInput.max, 10);
const minInput = document.getElementById("lowercase");
const majInput = document.getElementById("uppercase");
const symInput = document.getElementById("symbols");
const chiInput = document.getElementById("numbers");
const versionGroup = document.getElementById("versionGroup");

/** Niveaux de securite rendus par le background, en francais. */
const SECURITY_KEYS = {
  Aucune: "security_none",
  "Très Faible": "security_very_weak",
  Faible: "security_weak",
  Moyenne: "security_medium",
  Forte: "security_strong",
  "Très Forte": "security_very_strong",
};

function securityLabel(level) {
  return SECURITY_KEYS[level] ? msg(SECURITY_KEYS[level], level) : level;
}

/** Statut de la clef. `tone` colore sans dependre du theme : ok, error. */
function setStatus(text, tone = "") {
  statusDiv.textContent = text;
  statusDiv.dataset.tone = tone;
}

/** Version choisie pour la generation depuis la popup : v2 sauf demande. */
function selectedVersion() {
  return versionGroup.querySelector("input:checked")?.value === "1" ? 1 : 2;
}

versionGroup.addEventListener("change", () => {
  if (passInput.value) generatePassword();
});

// Rose en v1, bleu en v2 : voir algo-theme.js.
bindAlgoTheme(versionGroup, document.documentElement);

if (typeof browser === "undefined") {
  var browser = chrome;
}

// Chargement des paramètres sauvegardés
window.addEventListener("DOMContentLoaded", () => {
  refreshSyncState();
  hideResult();
  hideError();
  browser.runtime.sendMessage({ action: "checkEncodingKey" }, (resp) => {
    if (resp && resp.hasEncodingKey) {
      setStatus(msg("popup_key_set", "Clef définie."), "ok");
      browser.runtime.sendMessage({ action: "getEncodingKey" }, (resp) => {
        passInput.value = resp.encodingKey;
        refreshFingerprint(passInput.value.trim());
      });
    }
  });

  // Les paramètres sont lus depuis le background, seul détenteur de la
  // source de vérité (browser.storage.local) : la popup ne fait que les
  // afficher et les renvoyer quand l'utilisateur les modifie.
  browser.runtime.sendMessage({ action: "getParams" }, (resp) => {
    applyParams((resp && resp.params) || {});
  });
});

function applyParams(params) {
  if (params.lengthNumber !== undefined) lengthInput.value = params.lengthNumber;
  if (params.minState !== undefined) minInput.checked = params.minState;
  if (params.majState !== undefined) majInput.checked = params.majState;
  if (params.symState !== undefined) symInput.checked = params.symState;
  if (params.chiState !== undefined) chiInput.checked = params.chiState;
}

/// Enregistre les paramètres (le background les persiste et les renvoie
/// normalisés / bornés), puis régénère l'aperçu si une clef est disponible.
function updateParams(options) {
  browser.runtime.sendMessage({ action: "setParams", data: options }, (resp) => {
    if (!resp || !resp.ok) {
      setStatus(msg("popup_error_detail", "Erreur : $1", (resp && resp.error) || "n/a"), "error");
      return;
    }
    // Reflète la valeur réellement retenue (ex. 99 saisi → borné à 40).
    applyParams(resp.params);
    if (passInput.value) {
      generatePassword();
    }
  });
}

function getParams() {
  return {
    lengthNumber: lengthInput.value,
    minState: minInput.checked,
    majState: majInput.checked,
    symState: symInput.checked,
    chiState: chiInput.checked,
  };
}

[minInput, majInput, symInput, chiInput].forEach((input) => {
  input.addEventListener("change", () => updateParams(getParams()));
});

// Pour la longueur on écoute `input` (et non `change`) : le réglage est
// enregistré dès la frappe, sans attendre que le champ perde le focus — la
// popup peut être fermée juste après. On n'enregistre qu'une valeur déjà dans
// les bornes, sinon une saisie intermédiaire (« 3 » en tapant « 30 ») serait
// persistée puis ramenée à 4.
lengthInput.addEventListener("input", () => {
  const n = parseInt(lengthInput.value, 10);
  if (!Number.isNaN(n) && n >= MIN_LENGTH && n <= MAX_LENGTH) {
    updateParams(getParams());
  }
});
// Filet de sécurité à la sortie du champ : une valeur hors bornes ou vide est
// renvoyée au background, qui la borne et nous retourne la valeur retenue.
lengthInput.addEventListener("blur", () => updateParams(getParams()));

// Afficher / masquer la clef
toggleBtn.addEventListener("click", () => {
  const isHidden = passInput.type === "password";
  passInput.type = isHidden ? "text" : "password";
  toggleBtn.textContent = isHidden ? msg("popup_hide", "Cacher") : msg("popup_show", "Voir");
  toggleBtn.setAttribute("aria-pressed", String(isHidden));
});

// Définir la clef
setBtn.addEventListener("click", () => {
  setPassword();
});

// Déclenche setPassword() si on appuie sur "Entrée" dans passInput
// L'empreinte suit la saisie, pour que l'erreur se voie avant de generer.
passInput.addEventListener("input", () => refreshFingerprint(passInput.value.trim()));

passInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    setPassword();
  }
});

function setPassword() {
  const pass = passInput.value.trim();
  if (!pass) {
    return;
  }

  setStatus(msg("popup_deriving", "Dérivation en cours…"));

  browser.runtime.sendMessage({ action: "setEncodingKey", encodingKey: pass }, (resp) => {
    if (resp && resp.ok) {
      setStatus(msg("popup_key_set", "Clef définie."), "ok");
      generatePassword();
    } else {
      setStatus(msg("popup_error_detail", "Erreur : $1", (resp && resp.error) || "n/a"), "error");
    }
  });
}

// Effacer la clef
clearBtn.addEventListener("click", () => {
  browser.runtime.sendMessage({ action: "clearEncodingKey" }, (resp) => {
    if (resp && resp.ok) {
      setStatus(msg("popup_key_cleared", "Clef effacée."));
      passInput.value = "";
      refreshFingerprint("");
      hideResult();
      hideError();
    }
  });
});

// Copier le mot de passe
document.getElementById("copyPasswordBtn").addEventListener("click", () => {
  const pwd = passwordResult.textContent;
  if (!pwd) return;
  navigator.clipboard.writeText(pwd).then(
    () => (copyStatus.textContent = msg("popup_copied", "Copié.")),
    () => (copyStatus.textContent = msg("popup_copy_failed", "Copie impossible.")),
  );
});

// Générer un mot de passe pour l'onglet actif
generateBtn.addEventListener("click", () => {
  generatePassword();
});

/**
 * Identifiant du compte.
 *
 * Tant que l'utilisateur n'y a pas touche et qu'aucune generation n'a
 * repondu, on n'en envoie pas : le service worker retient alors la premiere
 * entree du domaine et rend son identifiant, qui pre-remplit le champ. Ensuite
 * c'est le champ qui fait foi, vide compris.
 */
let loginResolved = false;

loginInput.addEventListener("input", () => {
  loginResolved = true;
});

// `change` couvre la saisie validee et le choix dans la liste des comptes.
loginInput.addEventListener("change", () => {
  if (passInput.value) generatePassword();
});

loginInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    generatePassword();
  }
});

function requestedLogin() {
  return loginResolved ? loginInput.value.trim() : undefined;
}

/** `vaultMessage` remplace le statut du carnet une fois celui-ci relu. */
function generatePassword(vaultMessage) {
  // Aucune option n'est transmise : le background relit les paramètres
  // persistés, exactement comme pour le menu injecté dans la page. C'est ce
  // qui garantit un mot de passe identique des deux côtés.
  browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs.length) return;
    const tab = tabs[0];

    // Envoi du message au background pour générer le mot de passe
    browser.runtime.sendMessage(
      {
        action: "generatePassword",
        url: tab.url,
        version: selectedVersion(),
        login: requestedLogin(),
      },
      (response) => {
        if (!response || response.error) {
          hideResult();
          showError(response?.error || msg("popup_no_response", "Pas de réponse."));
        } else if (response.password) {
          hideError();
          showResult();
          if (!loginResolved) {
            loginInput.value = response.login || "";
            loginResolved = true;
          }
          currentEntryId = response.entryId || null;
          site.textContent = response.site;
          refreshVault(response.site, vaultMessage);
          passwordResult.textContent = response.password;
          // La couleur du niveau va sur une pastille : en texte, le vert vif
          // ne se lirait pas sur fond clair.
          passwordSecurity.style.setProperty("--level", response.color);
          passwordSecurity.textContent = `${securityLabel(response.security)} (${response.bits} bits)`;
        } else {
          hideResult();
          showError(msg("popup_no_response", "Pas de réponse."));
        }
      },
    );
  });
}

/** Domaine affiche, et l'entree du compte affiche s'il est dans le carnet. */
let currentDomain = "";
let currentEntryId = null;

/**
 * Affiche l'empreinte de la clef.
 *
 * Une faute de frappe sur la clef ne se voit pas autrement : elle produit
 * simplement un autre mot de passe, valide en apparence.
 */
async function refreshFingerprint(key) {
  if (!key) {
    fingerprintRow.hidden = true;
    return;
  }
  try {
    const { text, color } = await keyFingerprint(key);
    fingerprintChip.textContent = text;
    fingerprintChip.style.backgroundColor = color;
    fingerprintRow.hidden = false;
  } catch {
    fingerprintRow.hidden = true;
  }
}

/**
 * Charge les comptes du carnet pour le domaine courant.
 *
 * Plusieurs comptes sur un meme site : leurs identifiants sont proposes dans
 * le champ, il faut choisir, pas deviner. Un mauvais choix donne un mot de
 * passe qui ne marche pas, sans rien expliquer.
 */
function refreshVault(domain, message) {
  currentDomain = domain || "";
  loginOptions.innerHTML = "";
  if (!currentDomain) return;

  browser.runtime.sendMessage({ action: "getVault" }, (resp) => {
    const vault = resp?.vault || { entries: [] };
    const matches = (vault.entries || []).filter(
      (e) => !e.deleted && e.domains.some((d) => d.toLowerCase() === currentDomain.toLowerCase()),
    );

    loginOptions.innerHTML = "";
    for (const login of new Set(matches.map((e) => e.login || ""))) {
      if (!login) continue;
      const option = document.createElement("option");
      option.value = login;
      loginOptions.appendChild(option);
    }

    const known = Boolean(currentEntryId);
    vaultStatus.textContent = known
      ? msg("popup_account_saved_for", "Compte enregistré pour $1.", currentDomain)
      : matches.length
        ? msg(
            "popup_accounts_known",
            "$1 compte(s) connu(s) pour $2, pas celui-ci.",
            matches.length,
            currentDomain,
          )
        : msg("popup_not_in_vault", "$1 n'est pas encore dans le carnet.", currentDomain);
    if (message) vaultStatus.textContent = message;
    saveEntryBtn.textContent = known
      ? msg("popup_update_entry", "Mettre à jour l'entrée")
      : msg("popup_save", "Enregistrer");

    // Rien a renouveler tant que le compte n'est pas dans le carnet.
    refreshChangeButton();
    changePreview.hidden = true;
    pendingChange = null;
  });
}

/**
 * Le compteur — renouveler sans changer de clef — fait partie de l'offre
 * complete.
 *
 * L'etat sert a annoncer l'offre avant le clic ; c'est le service worker qui
 * refuse, puisque c'est lui qui ecrit le compteur.
 */
let canRenew = false;

function refreshChangeButton() {
  const known = Boolean(currentEntryId);
  changeEntryBtn.hidden = !known;
  // Jamais desactive : un bouton eteint n'explique rien et ne propose rien.
  // Le service worker refuse et rend le message, qui dit ce que l'offre
  // complete apporte et ou l'obtenir.
  renewPitch.hidden = !known || canRenew;
}

changeEntryBtn.addEventListener("click", () => {
  const id = currentEntryId;
  if (!id) return;

  vaultStatus.textContent = msg("popup_computing", "Calcul en cours…");

  browser.runtime.sendMessage({ action: "previewChange", id }, (resp) => {
    if (!resp?.ok) {
      vaultStatus.textContent = msg(
        "sync_failed",
        "Échec : $1",
        resp?.error || msg("sync_unknown_error", "inconnu"),
      );
      return;
    }
    pendingChange = { id };
    changeBefore.textContent = resp.before;
    changeAfter.textContent = resp.after;
    changePreview.hidden = false;
    vaultStatus.textContent = "";
  });
});

changeCancelBtn.addEventListener("click", () => {
  // Rien n'a ete ecrit : annuler ne laisse aucune trace.
  pendingChange = null;
  changePreview.hidden = true;
});

changeConfirmBtn.addEventListener("click", () => {
  if (!pendingChange) return;

  browser.runtime.sendMessage({ action: "applyChange", id: pendingChange.id }, (resp) => {
    if (!resp?.ok) {
      vaultStatus.textContent = msg(
        "sync_failed",
        "Échec : $1",
        resp?.error || msg("sync_unknown_error", "inconnu"),
      );
      return;
    }
    pendingChange = null;
    changePreview.hidden = true;
    generatePassword(msg("popup_renewed", "Entrée renouvelée, compteur $1.", resp.counter));
  });
});

saveEntryBtn.addEventListener("click", () => {
  if (!currentDomain) {
    vaultStatus.textContent = msg("popup_no_site", "Aucun site détecté.");
    return;
  }

  // Le compte est designe par domaine + identifiant. Le service worker relit
  // longueur et caracteres des parametres, ne reecrit jamais le siteKey, et
  // cree une entree v2 meme quand l'ecran est regle en v1.
  const login = loginInput.value.trim();
  browser.runtime.sendMessage({ action: "saveSite", domain: currentDomain, login }, (resp) => {
    if (resp && resp.ok) {
      loginResolved = true;
      generatePassword(
        resp.updated
          ? msg("popup_entry_updated", "Entrée mise à jour.")
          : msg("popup_account_saved", "Compte enregistré."),
      );
    } else {
      vaultStatus.textContent = msg(
        "sync_failed",
        "Échec : $1",
        resp?.error || msg("sync_unknown_error", "inconnu"),
      );
    }
  });
});

/** Montre la connexion ou les actions, selon qu'une session existe. */
function refreshSyncState() {
  browser.runtime.sendMessage({ action: "syncStatus" }, (resp) => {
    const connected = Boolean(resp?.connected);
    syncLoggedOut.hidden = connected;
    syncLoggedIn.hidden = !connected;
    if (!connected) syncStatus.textContent = "";
    canRenew = Boolean(resp?.canRenew);
    refreshChangeButton();
  });
}

syncLoginBtn.addEventListener("click", () => {
  const email = syncEmail.value.trim();
  const password = syncPassword.value;
  if (!email || !password) {
    syncStatus.textContent = msg(
      "sync_need_credentials",
      "Renseignez l'adresse et le mot de passe.",
    );
    return;
  }

  syncStatus.textContent = msg("sync_connecting", "Connexion…");
  browser.runtime.sendMessage({ action: "syncLogin", email, password }, (resp) => {
    if (resp && resp.ok) {
      // Le mot de passe du compte ne reste pas dans le DOM une fois utilise.
      syncPassword.value = "";
      syncStatus.textContent = msg("sync_connected", "Connecté.");
      refreshSyncState();
    } else {
      syncStatus.textContent = msg(
        "sync_failed",
        "Échec : $1",
        resp?.error || msg("sync_unknown_error", "inconnu"),
      );
    }
  });
});

syncNowBtn.addEventListener("click", () => {
  syncStatus.textContent = msg("sync_running", "Synchronisation…");
  browser.runtime.sendMessage({ action: "syncNow" }, (resp) => {
    if (resp && resp.ok) {
      const conflicts = resp.conflicts?.length
        ? msg("sync_conflicts", " ($1 conflit(s) signalé(s))", resp.conflicts.length)
        : "";
      // Au-dela du plafond, le reste ne part pas : le dire, sinon on croit
      // retrouver sur l'autre appareil ce qui n'y est jamais alle.
      const local = resp.localOnly
        ? msg(
            "sync_local_only",
            ", $1 restée(s) sur cet appareil (plafond de l'offre gratuite)",
            resp.localOnly,
          )
        : "";
      const done = msg("sync_done", "$1 entrée(s) synchronisée(s)", resp.entries);
      syncStatus.textContent = `${done}${local}${conflicts}`;
      refreshVault(currentDomain);
      // Les reglages par defaut ont pu venir d'un autre appareil.
      browser.runtime.sendMessage({ action: "getParams" }, (r) => {
        applyParams((r && r.params) || {});
      });
    } else {
      syncStatus.textContent = msg(
        "sync_failed",
        "Échec : $1",
        resp?.error || msg("sync_unknown_error", "inconnu"),
      );
    }
  });
});

syncLogoutBtn.addEventListener("click", () => {
  browser.runtime.sendMessage({ action: "syncLogout" }, () => {
    syncStatus.textContent = msg("sync_forgotten", "Session oubliée sur cet appareil.");
    refreshSyncState();
  });
});

function hideError() {
  errorContainer.hidden = true;
  error.textContent = "";
}

function showError(message) {
  error.textContent = message;
  errorContainer.hidden = false;
}

function hideResult() {
  resultBox.hidden = true;
  site.textContent = "";
  passwordResult.textContent = "";
  passwordSecurity.textContent = "";
  copyStatus.textContent = "";
}

function showResult() {
  resultBox.hidden = false;
  copyStatus.textContent = "";
}

/**
 * Parametres : une seconde vue, derriere la roue dentee.
 *
 * Le focus suit la navigation, sinon un utilisateur au clavier ou au lecteur
 * d'ecran resterait sur un bouton devenu invisible.
 */
const mainView = document.getElementById("mainView");
const settingsView = document.getElementById("settingsView");
const openSettingsBtn = document.getElementById("openSettings");

function showSettings(open) {
  mainView.hidden = open;
  settingsView.hidden = !open;
  openSettingsBtn.setAttribute("aria-expanded", String(open));
  if (open) {
    document.getElementById("settingsTitle").focus();
  } else {
    openSettingsBtn.focus();
  }
}

openSettingsBtn.addEventListener("click", () => showSettings(true));
document.getElementById("closeSettings").addEventListener("click", () => showSettings(false));
settingsView.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    showSettings(false);
  }
});

document.getElementById("openVault").addEventListener("click", () => {
  browser.tabs.create({ url: browser.runtime.getURL("vault-page.html") });
});

document.getElementById("openTransfer").addEventListener("click", () => {
  browser.tabs.create({ url: browser.runtime.getURL("transfer-page.html") });
});

/**
 * Annonce du passage a la v2, en fenetre modale a l'ouverture.
 *
 * Fermer la fait revenir la prochaine fois : seule la case a cocher la retire
 * pour de bon. Une annonce qu'on n'a pas eu le temps de lire ne doit pas
 * disparaitre pour toujours.
 */
const V2_NOTICE_KEY = "v2NoticeSeen";
const v2Notice = document.getElementById("v2Notice");
const v2NeverAgain = document.getElementById("v2NoticeNeverAgain");

browser.storage?.local?.get([V2_NOTICE_KEY], (stored) => {
  if (stored?.[V2_NOTICE_KEY]) return;
  v2Notice.hidden = false;
  document.getElementById("v2NoticeClose").focus();
});

document.getElementById("v2NoticeClose").addEventListener("click", () => {
  v2Notice.hidden = true;
  if (v2NeverAgain.checked) browser.storage?.local?.set({ [V2_NOTICE_KEY]: true });
});
