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

  // Branches pour l'ecran de gestion.
  function onUnlock() {}
  function onLock() {}

  start();
}

if (typeof document !== "undefined") {
  initVaultPage();
}

if (typeof module !== "undefined") {
  module.exports = { newPasswordError, VAULT_LOCK_MIN };
}
