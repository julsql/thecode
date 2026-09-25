/**
 * Ecran carnet : verrou, puis gestion des entrees.
 *
 * L'etat deverrouille ne vit que dans cette page, jamais dans le service
 * worker ni dans le stockage : fermer l'onglet reverrouille. Voir
 * shared/spec/vault-lock.md.
 */
if (typeof browser === "undefined" && typeof chrome !== "undefined") {
  var browser = chrome;
}

const VAULT_LOCK_MIN = 8;

/** Controle d'un nouveau mot de passe saisi deux fois. Rend un message ou null. */
function newPasswordError(password, confirmation) {
  if (!password || password.length < VAULT_LOCK_MIN) {
    return `Le mot de passe doit contenir au moins ${VAULT_LOCK_MIN} caractères.`;
  }
  if (password !== confirmation) return "Les deux mots de passe ne correspondent pas.";
  return null;
}

/** Entrees affichees : non supprimees, par libelle puis identifiant. */
function visibleEntries(vault) {
  return (vault?.entries || [])
    .filter((e) => !e.deleted)
    .sort(
      (a, b) =>
        (a.label || a.siteKey).localeCompare(b.label || b.siteKey) ||
        (a.login || "").localeCompare(b.login || ""),
    );
}

/** Jeux de caracteres actifs, en clair. */
function charsetLabel(charset = {}) {
  const names = [
    ["lower", "minuscules"],
    ["upper", "majuscules"],
    ["numbers", "chiffres"],
    ["symbols", "symboles"],
  ]
    .filter(([key]) => charset[key])
    .map(([, name]) => name);
  return names.length ? names.join(", ") : "aucun";
}

function send(message) {
  return new Promise((resolve) => browser.runtime.sendMessage(message, resolve));
}

function initVaultPage() {
  const $ = (id) => document.getElementById(id);
  const pageTitle = $("pageTitle");
  const pageStatus = $("pageStatus");
  const lockNowBtn = $("lockNow");
  const views = {
    create: $("createView"),
    unlock: $("unlockView"),
    unlocked: $("unlockedView"),
  };

  let unlocked = false;

  function say(text) {
    pageStatus.textContent = text;
  }

  function show(name) {
    for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
    lockNowBtn.hidden = name !== "unlocked";
    unlocked = name === "unlocked";
    if (name === "create") $("createPassword").focus();
    else if (name === "unlock") $("unlockPassword").focus();
    else pageTitle.focus();
  }

  function lock(message = "") {
    unlocked = false;
    $("unlockPassword").value = "";
    $("unlockError").textContent = "";
    showForget(false, false);
    onLock();
    show("unlock");
    say(message);
  }

  async function start() {
    const resp = await send({ action: "vaultLockStatus" });
    if (!resp?.ok) {
      say(`Erreur : ${resp?.error || "inconnue"}`);
      return;
    }
    show(resp.configured ? "unlock" : "create");
  }

  // Premiere ouverture : creation du mot de passe de carnet.
  views.create.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = $("createPassword").value;
    const problem = newPasswordError(password, $("createConfirm").value);
    $("createError").textContent = problem || "";
    if (problem) return;

    say("Création en cours…");
    const resp = await send({ action: "vaultLockCreate", password });
    $("createPassword").value = "";
    $("createConfirm").value = "";
    if (!resp?.ok) {
      say("");
      $("createError").textContent = resp?.error || "Échec.";
      return;
    }
    say("Mot de passe de carnet créé.");
    show("unlocked");
    onUnlock();
  });

  views.unlock.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("unlockPassword");
    if (!input.value) return;
    say("Vérification…");
    const resp = await send({ action: "vaultLockVerify", password: input.value });
    input.value = "";
    if (!resp?.ok || !resp.unlocked) {
      say("");
      $("unlockError").textContent = resp?.error || "Mot de passe incorrect.";
      input.focus();
      return;
    }
    $("unlockError").textContent = "";
    say("Carnet déverrouillé.");
    show("unlocked");
    onUnlock();
  });

  lockNowBtn.addEventListener("click", () => lock("Carnet verrouillé."));

  // Oubli : confirmation explicite, puis effacement du carnet local.
  function showForget(open, moveFocus = true) {
    $("forgetConfirm").hidden = !open;
    $("forgotBtn").setAttribute("aria-expanded", String(open));
    if (!moveFocus) return;
    if (open) $("forgetTitle").focus();
    else $("forgotBtn").focus();
  }

  $("forgotBtn").addEventListener("click", () => showForget(true));
  $("forgetCancelBtn").addEventListener("click", () => showForget(false));
  $("forgetConfirm").addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      showForget(false);
    }
  });
  $("forgetConfirmBtn").addEventListener("click", async () => {
    const resp = await send({ action: "vaultLockForget" });
    if (!resp?.ok) {
      say(`Échec : ${resp?.error || "inconnu"}`);
      return;
    }
    showForget(false, false);
    show("create");
    say("Carnet effacé de cet appareil. Choisissez un nouveau mot de passe de carnet.");
  });

  // Changement : l'actuel est exige, meme deverrouille.
  $("changeLockForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!unlocked) return;
    const current = $("changeCurrent").value;
    const next = $("changeNext").value;
    const problem = !current
      ? "Saisissez le mot de passe actuel."
      : newPasswordError(next, $("changeConfirm").value);
    $("changeLockError").textContent = problem || "";
    if (problem) return;

    say("Changement en cours…");
    const resp = await send({ action: "vaultLockChange", current, next });
    for (const id of ["changeCurrent", "changeNext", "changeConfirm"]) $(id).value = "";
    if (!resp?.ok) {
      say("");
      $("changeLockError").textContent = resp?.error || "Échec.";
      $("changeCurrent").focus();
      return;
    }
    say("Mot de passe de carnet changé.");
  });

  // Gestion : liste, detail, suppression, renouvellement.
  const entriesSection = $("entriesSection");
  const entriesList = $("entriesList");
  const detailView = $("detailView");
  const detailStatus = $("detailStatus");
  let entries = [];
  let current = null;
  let lastOpenedId = null;

  function onUnlock() {
    showDetail(null);
    loadEntries();
  }

  function onLock() {
    // Rien ne reste affiche derriere le verrou.
    entries = [];
    current = null;
    entriesList.replaceChildren();
    showDetail(null, false);
  }

  async function loadEntries(message) {
    const resp = await send({ action: "getVault" });
    if (!unlocked) return;
    if (!resp?.ok) {
      say(`Erreur : ${resp?.error || "inconnue"}`);
      return;
    }
    entries = visibleEntries(resp.vault);
    renderList();
    if (message) say(message);
  }

  function renderList() {
    $("entriesEmpty").hidden = entries.length > 0;
    entriesList.replaceChildren(
      ...entries.map((entry) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "entry";
        button.dataset.id = entry.id;
        const label = document.createElement("strong");
        label.textContent = entry.label || entry.siteKey;
        const login = document.createElement("span");
        login.textContent = entry.login || "sans identifiant";
        const domains = document.createElement("span");
        domains.className = "hint";
        domains.textContent = entry.domains.join(", ");
        button.append(label, login, domains);
        button.addEventListener("click", () => showDetail(entry));
        item.appendChild(button);
        return item;
      }),
    );
  }

  function showDetail(entry, moveFocus = true) {
    current = entry;
    entriesSection.hidden = Boolean(entry);
    detailView.hidden = !entry;
    $("renewPreview").hidden = true;
    $("deleteConfirm").hidden = true;
    detailStatus.textContent = "";
    if (!entry) {
      if (moveFocus && lastOpenedId) {
        entriesList.querySelector(`[data-id="${CSS.escape(lastOpenedId)}"]`)?.focus();
      }
      return;
    }
    lastOpenedId = entry.id;
    $("detailTitle").textContent = entry.label || entry.siteKey;
    $("detailSiteKey").textContent = entry.siteKey;
    $("detailDomains").textContent = entry.domains.join(", ");
    $("detailLogin").textContent = entry.login || "—";
    $("detailLength").textContent = String(entry.length);
    $("detailCharset").textContent = charsetLabel(entry.charset);
    $("detailCounter").textContent = String(entry.counter);
    $("detailVersion").textContent = `v${entry.v}`;
    $("detailUpdatedAt").textContent = new Date(entry.updatedAt).toLocaleString("fr-FR");
    if (moveFocus) $("detailTitle").focus();
  }

  $("detailBack").addEventListener("click", () => showDetail(null));
  detailView.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    if (!$("deleteConfirm").hidden) {
      $("deleteConfirm").hidden = true;
      $("deleteBtn").focus();
    } else if (!$("renewPreview").hidden) {
      $("renewPreview").hidden = true;
      $("renewBtn").focus();
    } else {
      showDetail(null);
    }
  });

  $("deleteBtn").addEventListener("click", () => {
    $("renewPreview").hidden = true;
    $("deleteConfirm").hidden = false;
    $("deleteTitle").focus();
  });
  $("deleteCancelBtn").addEventListener("click", () => {
    $("deleteConfirm").hidden = true;
    $("deleteBtn").focus();
  });
  $("deleteConfirmBtn").addEventListener("click", async () => {
    if (!unlocked || !current) return;
    const label = current.label || current.siteKey;
    // Pierre tombale ecrite par le service worker : deleted + updatedAt.
    const resp = await send({ action: "deleteEntry", id: current.id });
    if (!resp?.ok) {
      detailStatus.textContent = `Échec : ${resp?.error || "inconnu"}`;
      return;
    }
    lastOpenedId = null;
    showDetail(null, false);
    await loadEntries(`Entrée « ${label} » supprimée.`);
    pageTitle.focus();
  });

  // Renouvellement : meme parcours que la popup (previewChange / applyChange).
  $("renewBtn").addEventListener("click", async () => {
    if (!unlocked || !current) return;
    $("deleteConfirm").hidden = true;
    detailStatus.textContent = "Calcul en cours…";
    const resp = await send({ action: "previewChange", id: current.id });
    if (!resp?.ok) {
      detailStatus.textContent = `Échec : ${resp?.error || "inconnu"}`;
      return;
    }
    $("renewBefore").textContent = resp.before;
    $("renewAfter").textContent = resp.after;
    $("renewPreview").hidden = false;
    detailStatus.textContent = "";
  });
  $("renewCancel").addEventListener("click", () => {
    $("renewPreview").hidden = true;
    $("renewBtn").focus();
  });
  $("renewConfirm").addEventListener("click", async () => {
    if (!unlocked || !current) return;
    const id = current.id;
    const resp = await send({ action: "applyChange", id });
    if (!resp?.ok) {
      detailStatus.textContent = `Échec : ${resp?.error || "inconnu"}`;
      return;
    }
    await loadEntries();
    showDetail(entries.find((e) => e.id === id) || null, false);
    detailStatus.textContent = `Entrée renouvelée, compteur ${resp.counter}.`;
    $("renewBtn").focus();
  });

  start();
}

if (typeof document !== "undefined") {
  initVaultPage();
}

if (typeof module !== "undefined") {
  module.exports = { newPasswordError, visibleEntries, charsetLabel, VAULT_LOCK_MIN };
}
