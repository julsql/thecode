/**
 * Synchronisation du carnet puis des réglages, et son déclenchement
 * automatique (shared/spec/vault-sync.md, « Synchronisation automatique »).
 *
 * Un seul ordonnanceur pour tout le site : passer du générateur au carnet ne
 * doit ni doubler une synchronisation, ni remettre à zéro l'espacement des
 * ouvertures. La clef maîtresse est saisie sur la page : celle-ci la prête
 * le temps d'être affichée (`useAutoSync`).
 */
import { onMounted, onUnmounted, ref, type Ref } from "vue";
import { refreshPlan } from "@/account";
import { locked as sessionLocked } from "@/masterKey";
import { loadSettings, saveSettings, type DefaultSettings } from "@/settings";
import {
  loadSession,
  remoteRevision,
  saveSession,
  syncSettings,
  syncVault,
  SyncError,
} from "@/sync";
import { loadVault, mergeVaults, saveVault } from "@/vault";
import { createSyncScheduler, type SyncRun } from "@/syncScheduler";

export interface SyncOutcome {
  /** Entrées présentes sur le compte. */
  entries: number;
  /** Entrées restées sur l'appareil, au-delà du plafond. */
  localOnly: number;
  conflicts: number;
  /** Réglages venus du compte, déjà enregistrés, s'ils ont changé. */
  settings: DefaultSettings | null;
}

/** Motif court d'un échec, traduit par la page : jamais une fenêtre. */
export type SyncFailure = "network" | "auth" | "plan" | "forbidden" | "other";

export function syncFailureCode(error: unknown): SyncFailure {
  if (!(error instanceof SyncError)) return "other";
  if (error.status === 0) return "network";
  if (error.status === 401) return "auth";
  if (error.status === 402) return "plan";
  if (error.status === 403) return "forbidden";
  return "other";
}

/** Le carnet, puis les réglages. Rend ce qui a changé. */
export async function syncEverything(masterKey: string): Promise<SyncOutcome> {
  const session = loadSession();
  if (!session) throw new SyncError("no session");
  const result = await syncVault(loadVault(), masterKey, session);
  // Une entrée enregistrée ou supprimée pendant l'aller-retour n'est pas dans
  // ce résultat : on fusionne avec le carnet relu plutôt que de l'écraser.
  // Elle partira à la synchronisation que son écriture a demandée.
  saveVault(mergeVaults(loadVault(), result.vault).vault);
  saveSession(result.session);
  knownRevision = result.revision;
  // Les réglages suivent le carnet. Un échec ici n'annule pas la
  // synchronisation du carnet, déjà faite.
  let current = result.session;
  let settings: DefaultSettings | null = null;
  try {
    const synced = await syncSettings(loadSettings(), masterKey, current);
    current = synced.session;
    saveSession(current);
    if (synced.applied) {
      // Enregistrés avant l'affichage : l'écran les retrouve inchangés et ne
      // les redate pas.
      saveSettings(synced.settings);
      settings = synced.settings;
    }
  } catch {
    // Service sans réglages, ou coupure : le carnet est à jour.
  }
  // Un abonnement pris entre-temps doit se voir sans recharger la page.
  void refreshPlan(current);
  return {
    entries: result.vault.entries.filter((e) => !e.deleted).length - result.localOnly,
    localOnly: result.localOnly,
    conflicts: result.conflicts.length,
    settings,
  };
}

/**
 * Révision du compte à la dernière synchronisation : ce que la veille compare
 * à celle du service. Inconnue tant que rien n'a été synchronisé.
 */
let knownRevision: number | null = null;

/** Écart entre deux regards de la veille (`live`) sur la révision du compte. */
export const LIVE_SYNC_INTERVAL_MS = 5000;

/** Après un échec, la veille attend avant de retenter une synchronisation. */
export const LIVE_SYNC_RETRY_MS = 60000;
let retryAt = 0;

/**
 * Un seul appel au service à la fois : synchronisation et veille renouvellent
 * le même jeton rotatif, et deux renouvellements simultanés en perdraient un.
 * Le verrou du navigateur étend la règle aux autres onglets du site, qui
 * partagent la session ; à défaut, elle ne vaut que pour celui-ci.
 */
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks;
  const guarded = locks ? () => locks.request("thecode.sync", task) as Promise<T> : task;
  const next = queue.then(guarded, guarded);
  queue = next.catch(() => {});
  return next;
}

/** Échec de la dernière synchronisation, montré discrètement ; null sinon. */
export const lastSyncFailure = ref<SyncFailure | null>(null);

type Listener = (outcome: SyncOutcome) => void;

let lender: { key: Ref<string>; onSynced?: Listener } | null = null;

// Session verrouillée : la clef est gardée mais inutilisable, rien ne part.
const masterKey = () => (sessionLocked.value ? "" : (lender?.key.value.trim() ?? ""));

function build() {
  return createSyncScheduler<SyncOutcome>({
    run: () => exclusive(() => syncEverything(masterKey())),
    // Sans clef maîtresse, rien ne part : le carnet est chiffré avec elle.
    canSync: () => Boolean(loadSession()) && Boolean(masterKey()),
    onResult: (outcome: SyncRun<SyncOutcome>) => {
      if ("skipped" in outcome) return;
      lastSyncFailure.value = outcome.ok ? null : syncFailureCode(outcome.error);
      // Mauvaise clef, plafond, coupure : la veille ne doit pas retenter
      // toutes les 5 secondes une synchronisation qui échouera encore.
      retryAt = outcome.ok ? 0 : Date.now() + LIVE_SYNC_RETRY_MS;
      if (outcome.ok) lender?.onSynced?.(outcome.value);
    },
  });
}

let autoSync = build();

/** Bouton « Synchroniser » : tout de suite, après celle en cours. */
export function runSyncNow(): Promise<SyncRun<SyncOutcome>> {
  return autoSync.runNow();
}

/** Après une écriture locale ou un réglage modifié. */
export function scheduleAutoSync(): void {
  if (loadSession() && masterKey()) autoSync.trigger();
}

/**
 * Veille : un autre appareil a-t-il écrit sur le compte ? Si oui, synchronise
 * tout de suite. Rien ne part sans session ni clef, onglet masqué, ou quand
 * une synchronisation attend ou tourne déjà.
 */
export async function checkRemote(): Promise<void> {
  if (checking || !loadSession() || !masterKey()) return;
  if (document.visibilityState !== "visible") return;
  if (autoSync.pending || autoSync.running) return;
  if (Date.now() < retryAt) return;
  checking = true;
  try {
    const since = knownRevision;
    if (since !== null && !(await exclusive(() => remoteMoved(since)))) return;
    await autoSync.runNow();
  } catch {
    // Coupure : la prochaine veille réessaiera, sans message.
  } finally {
    checking = false;
  }
}

/** Un regard à la fois : un service lent ne doit pas les empiler. */
let checking = false;

async function remoteMoved(since: number): Promise<boolean> {
  const session = loadSession();
  if (!session) return false;
  const remote = await remoteRevision(session, since);
  if (remote.session !== session) saveSession(remote.session);
  return remote.revision !== since;
}

/**
 * Branche la page sur la synchronisation automatique : elle prête sa clef
 * maîtresse, reçoit ce qui a changé, et synchronise à son ouverture.
 *
 * `live` : tant que la page est affichée, elle surveille le compte et se met
 * à jour d'elle-même quand un autre appareil y écrit.
 */
export function useAutoSync(key: Ref<string>, onSynced?: Listener, { live = false } = {}) {
  const mine = { key, onSynced };
  let watcher: ReturnType<typeof setInterval> | null = null;
  const onVisible = () => {
    if (document.visibilityState === "visible") void checkRemote();
  };
  onMounted(() => {
    lender = mine;
    if (loadSession() && masterKey()) autoSync.triggerOpen();
    if (!live) return;
    watcher = setInterval(() => void checkRemote(), LIVE_SYNC_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
  });
  onUnmounted(() => {
    if (lender === mine) lender = null;
    if (watcher !== null) clearInterval(watcher);
    document.removeEventListener("visibilitychange", onVisible);
  });
  return {
    /** Quand la clef vient d'être saisie : compte comme une ouverture. */
    keyEntered() {
      if (loadSession() && masterKey()) autoSync.triggerOpen();
    },
    /** Clef saisie sur un écran qui montre le carnet : sans attendre. */
    syncNow() {
      if (loadSession() && masterKey()) void autoSync.runNow();
    },
  };
}

/** Pour les tests : l'espacement des ouvertures ne survit pas d'un test à l'autre. */
export function resetAutoSyncForTests(): void {
  autoSync.cancel();
  autoSync = build();
  lender = null;
  lastSyncFailure.value = null;
  knownRevision = null;
  checking = false;
  retryAt = 0;
  queue = Promise.resolve();
}
