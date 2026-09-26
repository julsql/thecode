/**
 * Ecran carnet : verrou, puis gestion des entrees.
 *
 * Le carnet s'ouvre avec la clef maitresse : le service worker la compare a
 * celle de la session, ou l'y pose si aucune n'est encore definie. L'etat
 * deverrouille vit dans cette page. Le service worker ne retient que l'instant
 * ou elle a ete quittee : revenu dans les 3 minutes, le carnet est toujours
 * ouvert (vault-session.js). « Verrouiller » ferme toute la session, pas
 * seulement cet ecran. Voir shared/spec/vault-lock.md.
 */
if (typeof browser === "undefined" && typeof chrome !== "undefined") {
  var browser = chrome;
}
// msg() vient de i18n.js et isWithinVaultGrace() de vault-session.js, charges
// avant ce fichier ; en test, on les requiert.
if (typeof module !== "undefined" && typeof require === "function") {
  Object.assign(globalThis, require("./i18n.js"), require("./vault-session.js"));
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
    ["lower", "vault_charset_lower", "minuscules"],
    ["upper", "vault_charset_upper", "majuscules"],
    ["numbers", "vault_charset_numbers", "chiffres"],
    ["symbols", "vault_charset_symbols", "symboles"],
  ]
    .filter(([key]) => charset[key])
    .map(([, id, name]) => msg(id, name));
  return names.length ? names.join(", ") : msg("vault_charset_none", "aucun");
}

/** Message d'erreur d'une reponse du service worker. */
function errorText(resp) {
  return resp?.error
    ? msg("vault_error_detail", "Erreur : $1", resp.error)
    : msg("vault_error_unknown", "Erreur inconnue.");
}

/** Message d'echec d'une reponse du service worker. */
function failureText(resp) {
  return resp?.error
    ? msg("vault_failure_detail", "Échec : $1", resp.error)
    : msg("vault_failure", "Échec.");
}

/** Message d'une reponse a `vaultUnlock` qui n'ouvre pas le carnet. */
function unlockErrorText(resp) {
  if (resp?.ok && resp.reason === "otherKey") {
    return msg("vault_other_key", "Ce n'est pas la même clef que celle en cours d'utilisation.");
  }
  return resp?.ok ? msg("vault_failure", "Échec.") : errorText(resp);
}

function send(message) {
  return new Promise((resolve) => browser.runtime.sendMessage(message, resolve));
}

function initVaultPage() {
  translatePage();
  // Synchronisation automatique a l'ouverture, espacee par le fond.
  browser.runtime.sendMessage({ action: "syncAutoOpen" }, () => {});
  const $ = (id) => document.getElementById(id);
  const pageTitle = $("pageTitle");
  const pageStatus = $("pageStatus");
  const lockNowBtn = $("lockNow");
  const views = {
    unlock: $("unlockView"),
    unlocked: $("unlockedView"),
  };

  let unlocked = false;

  function say(text) {
    pageStatus.textContent = text;
  }

  /** Signale qu'aucune clef n'est encore definie : la saisie la posera. */
  async function refreshKeyHint() {
    const resp = await send({ action: "checkEncodingKey" });
    $("unlockNewSession").hidden = Boolean(resp?.hasEncodingKey);
  }

  function show(name) {
    for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
    lockNowBtn.hidden = name !== "unlocked";
    unlocked = name === "unlocked";
    if (name === "unlock") {
      refreshKeyHint();
      $("unlockKey").focus();
    } else pageTitle.focus();
  }

  /**
   * Referme l'ecran. `session` : « Verrouiller » ferme toute la session
   * (generation, synchronisation comprises) jusqu'a la ressaisie de la clef ;
   * sinon (grace ecoulee) seul l'ecran carnet se referme.
   */
  function lock(message = "", { session = false } = {}) {
    unlocked = false;
    leftAt = null;
    send({ action: session ? "lockSession" : "vaultSessionClear" });
    $("unlockKey").value = "";
    $("unlockError").textContent = "";
    onLock();
    show("unlock");
    say(message);
  }

  async function start() {
    // Revenu dans la grace : pas de nouvelle demande de clef.
    const session = await send({ action: "vaultSessionResume" });
    if (session?.ok && session.unlocked) {
      show("unlocked");
      onUnlock();
    } else {
      show("unlock");
    }
  }

  // Grace de 3 minutes : quitter l'ecran (onglet masque ou ferme, navigation)
  // fait courir la fenetre. L'instant est aussi garde ici : un autre onglet
  // carnet quitte plus tard ne doit pas prolonger celui-ci.
  let leftAt = null;

  function leave() {
    if (!unlocked) return;
    leftAt = Date.now();
    send({ action: "vaultSessionLeave" });
  }

  async function comeBack() {
    if (!unlocked || leftAt === null) return;
    const since = leftAt;
    leftAt = null;
    const session = await send({ action: "vaultSessionResume" });
    if (!isWithinVaultGrace(since, Date.now()) || !session?.ok || !session.unlocked) {
      lock(msg("vault_locked", "Carnet verrouillé."));
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") leave();
    else comeBack();
  });
  window.addEventListener("pagehide", leave);
  // Retour depuis le cache avant/arriere : la page n'est pas rechargee.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) comeBack();
  });

  views.unlock.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("unlockKey");
    if (!input.value) return;
    say(msg("vault_checking", "Vérification…"));
    const resp = await send({ action: "vaultUnlock", encodingKey: input.value });
    input.value = "";
    if (!resp?.ok || !resp.unlocked) {
      say("");
      $("unlockError").textContent = unlockErrorText(resp);
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    input.removeAttribute("aria-invalid");
    $("unlockError").textContent = "";
    say(
      resp.keySet
        ? msg("vault_unlocked_key_set", "Carnet déverrouillé. Cette clef sert aussi au générateur.")
        : msg("vault_unlocked", "Carnet déverrouillé."),
    );
    show("unlocked");
    onUnlock();
  });

  lockNowBtn.addEventListener("click", () =>
    lock(msg("vault_session_locked", "TheCode verrouillé. Saisissez votre clef pour le rouvrir."), {
      session: true,
    }),
  );

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
      say(errorText(resp));
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
        login.textContent = entry.login || msg("vault_no_login", "sans identifiant");
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
    $("detailUpdatedAt").textContent = new Date(entry.updatedAt).toLocaleString(uiLocale());
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
      detailStatus.textContent = failureText(resp);
      return;
    }
    lastOpenedId = null;
    showDetail(null, false);
    await loadEntries(msg("vault_entry_deleted", "Entrée « $1 » supprimée.", label));
    pageTitle.focus();
  });

  // Renouvellement : meme parcours que la popup (previewChange / applyChange).
  $("renewBtn").addEventListener("click", async () => {
    if (!unlocked || !current) return;
    $("deleteConfirm").hidden = true;
    detailStatus.textContent = msg("vault_computing", "Calcul en cours…");
    const resp = await send({ action: "previewChange", id: current.id });
    if (!resp?.ok) {
      detailStatus.textContent = failureText(resp);
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
      detailStatus.textContent = failureText(resp);
      return;
    }
    await loadEntries();
    showDetail(entries.find((e) => e.id === id) || null, false);
    detailStatus.textContent = msg(
      "vault_entry_renewed",
      "Entrée renouvelée, compteur $1.",
      resp.counter,
    );
    $("renewBtn").focus();
  });

  start();
}

if (typeof document !== "undefined") {
  initVaultPage();
}

if (typeof module !== "undefined") {
  module.exports = { visibleEntries, charsetLabel, unlockErrorText };
}
