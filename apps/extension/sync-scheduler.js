/**
 * Synchronisation automatique (shared/spec/vault-sync.md).
 *
 * Pur : ni stockage ni reseau, seulement l'ordonnancement. `run` fait la
 * synchronisation, `canSync` dit si elle peut partir (session et clef
 * maitresse). Les minuteries et l'horloge sont injectables pour les tests.
 *
 * - les declencheurs rapproches sont fusionnes : attente de `delay` apres le
 *   dernier ;
 * - une synchronisation en cours n'est jamais doublee : une demande pendant
 *   qu'elle tourne en relance une seule, juste apres ;
 * - a l'ouverture, pas plus d'une fois toutes les `openThrottle` ms.
 */

const AUTO_SYNC_DELAY_MS = 2000;
const AUTO_SYNC_OPEN_THROTTLE_MS = 30000;

function createSyncScheduler({
  run,
  canSync = () => true,
  onResult = () => {},
  delay = AUTO_SYNC_DELAY_MS,
  openThrottle = AUTO_SYNC_OPEN_THROTTLE_MS,
  now = () => Date.now(),
  setTimer = (fn, ms) => {
    const id = setTimeout(fn, ms);
    // Node seulement (tests) : une minuterie en attente ne retient pas le process.
    id?.unref?.();
    return id;
  },
  clearTimer = (id) => clearTimeout(id),
}) {
  let timer = null;
  let running = null;
  let queued = false;
  let lastOpen = null;

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function execute() {
    const current = (async () => {
      let allowed = false;
      try {
        allowed = await canSync();
      } catch {
        allowed = false;
      }
      if (!allowed) return { ok: false, skipped: true };
      let result;
      try {
        result = await run();
      } catch (e) {
        result = { ok: false, error: e?.message || String(e) };
      }
      try {
        await onResult(result);
      } catch {
        // Le statut est un confort : son echec ne change pas le resultat.
      }
      return result;
    })();
    running = current;
    current.then(() => {
      running = null;
      if (queued) {
        queued = false;
        execute();
      }
    });
    return current;
  }

  function fire() {
    timer = null;
    if (running) {
      queued = true;
      return;
    }
    execute();
  }

  /** Apres une ecriture locale ou un reglage : attend `delay` de calme. */
  function trigger() {
    cancelTimer();
    timer = setTimer(fire, delay);
  }

  /** A l'ouverture : espace de `openThrottle`. Rend faux si ignore. */
  function triggerOpen() {
    const t = now();
    if (lastOpen !== null && t - lastOpen < openThrottle) return false;
    lastOpen = t;
    trigger();
    return true;
  }

  /** Bouton « Synchroniser » : tout de suite, apres celle en cours. */
  async function runNow() {
    cancelTimer();
    queued = false;
    while (running) await running;
    return execute();
  }

  return {
    trigger,
    triggerOpen,
    runNow,
    get pending() {
      return timer !== null;
    },
    get running() {
      return running !== null;
    },
  };
}

/** Motif court d'un echec, traduit par la popup : jamais le detail brut. */
function syncFailureCode(error = "") {
  const text = String(error);
  if (text.startsWith("401")) return "auth";
  if (text.startsWith("402")) return "plan";
  if (text.startsWith("403")) return "forbidden";
  if (text.startsWith("Service injoignable")) return "network";
  return "other";
}

if (typeof module !== "undefined") {
  module.exports = {
    AUTO_SYNC_DELAY_MS,
    AUTO_SYNC_OPEN_THROTTLE_MS,
    createSyncScheduler,
    syncFailureCode,
  };
}
