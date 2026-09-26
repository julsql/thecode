/**
 * Ordonnanceur de la synchronisation automatique (shared/spec/vault-sync.md).
 *
 * Pur : ni stockage ni réseau, seulement l'ordonnancement. `run` fait la
 * synchronisation, `canSync` dit si elle peut partir (session et clef
 * maîtresse). Minuteries et horloge sont injectables pour les tests.
 *
 * - les déclencheurs rapprochés sont fusionnés : attente de `delay` après le
 *   dernier ;
 * - une synchronisation en cours n'est jamais doublée : une demande pendant
 *   qu'elle tourne en relance une seule, juste après ;
 * - à l'ouverture, pas plus d'une fois toutes les `openThrottle` ms.
 */

export const AUTO_SYNC_DELAY_MS = 2000;
export const AUTO_SYNC_OPEN_THROTTLE_MS = 30000;

/** Issue d'une synchronisation : son résultat, un échec, ou rien de lancé. */
export type SyncRun<R> = { ok: true; value: R } | { ok: false; error: unknown } | { skipped: true };

export interface SyncSchedulerOptions<R> {
  run: () => Promise<R>;
  canSync?: () => boolean | Promise<boolean>;
  onResult?: (outcome: SyncRun<R>) => void;
  delay?: number;
  openThrottle?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

export interface SyncScheduler<R> {
  /** Après une écriture locale ou un réglage : attend `delay` de calme. */
  trigger(): void;
  /** À l'ouverture : espacé de `openThrottle`. Rend faux si ignoré. */
  triggerOpen(): boolean;
  /** Bouton « Synchroniser » : tout de suite, après celle en cours. */
  runNow(): Promise<SyncRun<R>>;
  /** Oublie ce qui attend (la synchronisation en cours va à son terme). */
  cancel(): void;
  readonly pending: boolean;
  readonly running: boolean;
}

export function createSyncScheduler<R>({
  run,
  canSync = () => true,
  onResult = () => {},
  delay = AUTO_SYNC_DELAY_MS,
  openThrottle = AUTO_SYNC_OPEN_THROTTLE_MS,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
}: SyncSchedulerOptions<R>): SyncScheduler<R> {
  let timer: unknown = null;
  let running: Promise<SyncRun<R>> | null = null;
  let queued = false;
  let lastOpen: number | null = null;

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function execute(): Promise<SyncRun<R>> {
    const current = (async (): Promise<SyncRun<R>> => {
      let allowed = false;
      try {
        allowed = await canSync();
      } catch {
        allowed = false;
      }
      if (!allowed) return { skipped: true };
      let outcome: SyncRun<R>;
      try {
        outcome = { ok: true, value: await run() };
      } catch (error) {
        outcome = { ok: false, error };
      }
      try {
        onResult(outcome);
      } catch {
        // Le statut est un confort : son échec ne change pas le résultat.
      }
      return outcome;
    })();
    running = current;
    void current.then(() => {
      running = null;
      if (queued) {
        queued = false;
        void execute();
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
    void execute();
  }

  function trigger() {
    cancelTimer();
    timer = setTimer(fire, delay);
  }

  function triggerOpen() {
    const t = now();
    if (lastOpen !== null && t - lastOpen < openThrottle) return false;
    lastOpen = t;
    trigger();
    return true;
  }

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
    cancel() {
      cancelTimer();
      queued = false;
    },
    get pending() {
      return timer !== null;
    },
    get running() {
      return running !== null;
    },
  };
}
