/**
 * Session de l'ecran carnet : meme grace de 3 minutes que la clef.
 *
 * Quitter l'ecran (onglet ferme ou masque, navigation) fait courir la fenetre ;
 * revenu a temps, le carnet est toujours ouvert. Seul l'instant de sortie est
 * retenu, jamais un secret. Voir shared/spec/vault-lock.md, « Session ».
 */

const VAULT_SESSION_GRACE_MS = 3 * 60 * 1000;
const VAULT_SESSION_STORAGE_KEY = "vaultSessionLeftAt";

/**
 * Vrai si une sortie a `leftAt` laisse le carnet ouvert a `now`. Une horloge
 * qui recule referme : on ne sait plus combien de temps s'est ecoule.
 */
function isWithinVaultGrace(leftAt, now, grace = VAULT_SESSION_GRACE_MS) {
  if (!Number.isFinite(leftAt) || !Number.isFinite(now)) return false;
  const elapsed = now - leftAt;
  return elapsed >= 0 && elapsed <= grace;
}

/**
 * Instant de sortie, cote service worker.
 *
 * `area` est browser.storage.session quand il existe (Chrome MV3, Firefox 115
 * et plus) : en memoire seulement, vide au redemarrage du navigateur, et il
 * survit a l'arret du service worker. Sans lui, ou s'il echoue, une variable
 * du fond en tient lieu : perdue plus tot, ce qui ne fait que reverrouiller.
 */
function createVaultSession(area) {
  let memory = null;
  let usable = Boolean(area && typeof area.get === "function");

  async function read() {
    if (usable) {
      try {
        const stored = await area.get([VAULT_SESSION_STORAGE_KEY]);
        const value = stored?.[VAULT_SESSION_STORAGE_KEY];
        return Number.isFinite(value) ? value : null;
      } catch {
        usable = false;
      }
    }
    return memory;
  }

  async function write(value) {
    memory = value;
    if (!usable) return;
    try {
      if (value === null) await area.remove([VAULT_SESSION_STORAGE_KEY]);
      else await area.set({ [VAULT_SESSION_STORAGE_KEY]: value });
    } catch {
      usable = false;
    }
  }

  return {
    /** L'ecran carnet deverrouille vient d'etre quitte. */
    leave: (now) => write(now),
    /** Rend vrai si le carnet est encore ouvert ; sinon efface l'instant. */
    async resume(now) {
      const leftAt = await read();
      if (isWithinVaultGrace(leftAt, now)) return true;
      if (leftAt !== null) await write(null);
      return false;
    },
    /** « Verrouiller », « Mot de passe oublie » : referme aussitot. */
    clear: () => write(null),
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    VAULT_SESSION_GRACE_MS,
    VAULT_SESSION_STORAGE_KEY,
    isWithinVaultGrace,
    createVaultSession,
  };
}
