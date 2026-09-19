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
const siteContainer = document.getElementById("siteContainer");
const passwordResultContainer = document.getElementById("passwordResultContainer");
const passwordSecurityContainer = document.getElementById("passwordSecurityContainer");
const errorContainer = document.getElementById("errorContainer");
const fingerprintRow = document.getElementById("fingerprintRow");
const fingerprintChip = document.getElementById("fingerprint");
const accountRow = document.getElementById("accountRow");
const accountSelect = document.getElementById("accountSelect");
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

const lengthInput = document.getElementById("length");
// Bornes lues sur le champ lui-même, pour ne pas les redéclarer ici en plus
// du HTML et du background (qui reste l'autorité : il borne ce qu'on envoie).
const MIN_LENGTH = parseInt(lengthInput.min, 10);
const MAX_LENGTH = parseInt(lengthInput.max, 10);
const minInput = document.getElementById("lowercase");
const majInput = document.getElementById("uppercase");
const symInput = document.getElementById("symbols");
const chiInput = document.getElementById("numbers");

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
      statusDiv.style.color = "green";
      statusDiv.textContent = "Clef définie.";
      browser.runtime.sendMessage({ action: "getEncodingKey" }, (resp) => {
        passInput.value = resp.encodingKey;
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
      statusDiv.style.color = "red";
      statusDiv.textContent = "Erreur: " + ((resp && resp.error) || "n/a");
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
  toggleBtn.textContent = isHidden ? "Cacher" : "Voir";
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

  statusDiv.style.color = "black";
  statusDiv.textContent = "Dérivation en cours...";

  browser.runtime.sendMessage({ action: "setEncodingKey", encodingKey: pass }, (resp) => {
    if (resp && resp.ok) {
      statusDiv.style.color = "green";
      statusDiv.textContent = "Clef définie.";
      generatePassword();
    } else {
      statusDiv.style.color = "red";
      statusDiv.textContent = "Erreur: " + ((resp && resp.error) || "n/a");
    }
  });
}

// Effacer la clef
clearBtn.addEventListener("click", () => {
  browser.runtime.sendMessage({ action: "clearEncodingKey" }, (resp) => {
    if (resp && resp.ok) {
      statusDiv.style.color = "black";
      statusDiv.textContent = "Clef effacée.";
      passInput.value = "";
      hideResult();
      hideError();
    }
  });
});

// Copier le mot de passe
document.getElementById("copyPasswordBtn").addEventListener("click", () => {
  const pwd = document.getElementById("passwordResult").textContent;
  if (pwd) {
    navigator.clipboard.writeText(pwd).then(() => {});
  }
});

// Générer un mot de passe pour l'onglet actif avec les paramètres avancés
generateBtn.addEventListener("click", () => {
  generatePassword();
});

function generatePassword() {
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
      },
      (response) => {
        if (response.error) {
          hideResult();
          showError();
          error.style.display = "block";
          error.textContent = response.error;
        } else if (response.password) {
          hideError();
          showResult();
          site.textContent = response.site;
          refreshVault(response.site);
          passwordResult.textContent = response.password;
          passwordSecurity.style.color = response.color;
          passwordSecurity.textContent = `${response.security} (${response.bits} bits)`;
        } else {
          hideResult();
          showError();
          error.style.display = "block";
          error.textContent = "Pas de réponse.";
        }
      },
    );
  });
}

/** Entrees du carnet couvrant le domaine affiche, et celle retenue. */
let currentDomain = "";
let currentMatches = [];

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

/** Charge les entrees du carnet pour le domaine courant. */
function refreshVault(domain) {
  currentDomain = domain || "";
  if (!currentDomain) {
    accountRow.hidden = true;
    return;
  }

  browser.runtime.sendMessage({ action: "getVault" }, (resp) => {
    const vault = resp?.vault || { entries: [] };
    currentMatches = (vault.entries || []).filter(
      (e) => !e.deleted && e.domains.some((d) => d.toLowerCase() === currentDomain.toLowerCase()),
    );

    // Un seul compte : rien a choisir, on n'encombre pas l'interface.
    accountRow.hidden = currentMatches.length < 2;
    if (currentMatches.length >= 2) {
      accountSelect.innerHTML = "";
      currentMatches.forEach((entry, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = entry.login || entry.label || entry.siteKey;
        accountSelect.appendChild(option);
      });
    }

    vaultStatus.textContent = currentMatches.length
      ? `${currentMatches.length} entrée(s) connue(s) pour ${currentDomain}`
      : `${currentDomain} n'est pas encore dans le carnet`;
    saveEntryBtn.textContent = currentMatches.length
      ? "Mettre à jour l'entrée"
      : "Enregistrer ce site";

    // Rien a renouveler ni a migrer tant que le site n'est pas dans le carnet.
    refreshChangeButton();
    changePreview.hidden = true;
    pendingChange = null;
  });
}

/**
 * Le compteur — renouveler sans changer de clef — fait partie de l'offre
 * complete. La migration v1 vers v2 reste ouverte a tous : c'est une mise a
 * niveau, pas un service.
 */
let canRenew = false;

function refreshChangeButton() {
  const target = currentMatches[0];
  changeEntryBtn.hidden = !target;
  if (!target) return;

  const renew = target.v >= 2;
  changeEntryBtn.textContent = renew ? "Renouveler" : "Passer en v2";
  changeEntryBtn.disabled = renew && !canRenew;
  changeEntryBtn.title =
    renew && !canRenew ? "Offre complete requise : https://thecode.julsql.fr/fr/account" : "";
}

/** L'entree visee : celle choisie quand il y en a plusieurs. */
function selectedEntry() {
  if (currentMatches.length < 2) return currentMatches[0];
  return currentMatches[Number(accountSelect.value) || 0];
}

changeEntryBtn.addEventListener("click", () => {
  const entry = selectedEntry();
  if (!entry) return;

  const renew = entry.v >= 2;
  vaultStatus.textContent = "Calcul en cours…";

  browser.runtime.sendMessage({ action: "previewChange", id: entry.id, renew }, (resp) => {
    if (!resp?.ok) {
      vaultStatus.textContent = `Échec : ${resp?.error || "inconnu"}`;
      return;
    }
    pendingChange = { id: entry.id, renew };
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

  browser.runtime.sendMessage(
    { action: "applyChange", id: pendingChange.id, renew: pendingChange.renew },
    (resp) => {
      if (!resp?.ok) {
        vaultStatus.textContent = `Échec : ${resp?.error || "inconnu"}`;
        return;
      }
      const renewed = pendingChange.renew;
      pendingChange = null;
      changePreview.hidden = true;
      vaultStatus.textContent = renewed
        ? `Entrée renouvelée, compteur ${resp.counter}.`
        : "Entrée passée en v2.";
      refreshVault(currentDomain);
    },
  );
});

saveEntryBtn.addEventListener("click", () => {
  if (!currentDomain) {
    vaultStatus.textContent = "Aucun site détecté.";
    return;
  }

  const params = getParams();
  const charset = {
    lower: params.minState,
    upper: params.majState,
    symbols: params.symState,
    numbers: params.chiState,
  };
  const existing = currentMatches[0];

  // siteKey n'est jamais reecrit : il produit le mot de passe, le modifier
  // en changerait un deja en service.
  const entry = existing
    ? { ...existing, length: Number(params.length), charset }
    : {
        id: crypto.randomUUID(),
        label: currentDomain,
        siteKey: currentDomain,
        domains: [currentDomain],
        login: "",
        counter: 1,
        length: Number(params.length),
        charset,
        v: 1,
        updatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      };

  browser.runtime.sendMessage({ action: "saveEntry", entry }, (resp) => {
    if (resp && resp.ok) {
      vaultStatus.textContent = existing ? "Entrée mise à jour." : "Site enregistré.";
      refreshVault(currentDomain);
    } else {
      vaultStatus.textContent = `Échec : ${resp?.error || "inconnu"}`;
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
    syncStatus.textContent = "Renseignez l'adresse et le mot de passe.";
    return;
  }

  syncStatus.textContent = "Connexion…";
  browser.runtime.sendMessage({ action: "syncLogin", email, password }, (resp) => {
    if (resp && resp.ok) {
      // Le mot de passe du compte ne reste pas dans le DOM une fois utilise.
      syncPassword.value = "";
      syncStatus.textContent = "Connecté.";
      refreshSyncState();
    } else {
      syncStatus.textContent = `Échec : ${resp?.error || "inconnu"}`;
    }
  });
});

syncNowBtn.addEventListener("click", () => {
  syncStatus.textContent = "Synchronisation…";
  browser.runtime.sendMessage({ action: "syncNow" }, (resp) => {
    if (resp && resp.ok) {
      const conflicts = resp.conflicts?.length
        ? ` (${resp.conflicts.length} conflit(s) signalé(s))`
        : "";
      syncStatus.textContent = `${resp.entries} entrée(s) synchronisée(s)${conflicts}`;
      refreshVault(currentDomain);
    } else {
      syncStatus.textContent = `Échec : ${resp?.error || "inconnu"}`;
    }
  });
});

syncLogoutBtn.addEventListener("click", () => {
  browser.runtime.sendMessage({ action: "syncLogout" }, () => {
    syncStatus.textContent = "Session oubliée sur cet appareil.";
    refreshSyncState();
  });
});

function hideError() {
  errorContainer.style.display = "none";
  error.textContent = "";
}

function showError() {
  errorContainer.style.display = "block";
}

function hideResult() {
  siteContainer.style.display = "none";
  site.textContent = "";
  passwordResultContainer.style.display = "none";
  passwordResult.textContent = "";
  passwordSecurityContainer.style.display = "none";
  passwordSecurity.textContent = "";
}

function showResult() {
  siteContainer.style.display = "block";
  passwordResultContainer.style.display = "block";
  passwordSecurityContainer.style.display = "block";
}

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
  if (!stored?.[V2_NOTICE_KEY]) v2Notice.hidden = false;
});

document.getElementById("v2NoticeClose").addEventListener("click", () => {
  v2Notice.hidden = true;
  if (v2NeverAgain.checked) browser.storage?.local?.set({ [V2_NOTICE_KEY]: true });
});
