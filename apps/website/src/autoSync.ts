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
import { loadSettings, saveSettings, type DefaultSettings } from "@/settings";
import { loadSession, saveSession, syncSettings, syncVault, SyncError } from "@/sync";
import { loadVault, saveVault } from "@/vault";
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
  saveVault(result.vault);
  saveSession(result.session);
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

/** Échec de la dernière synchronisation, montré discrètement ; null sinon. */
export const lastSyncFailure = ref<SyncFailure | null>(null);

type Listener = (outcome: SyncOutcome) => void;

let lender: { key: Ref<string>; onSynced?: Listener } | null = null;

const masterKey = () => lender?.key.value.trim() ?? "";

function build() {
  return createSyncScheduler<SyncOutcome>({
    run: () => syncEverything(masterKey()),
    // Sans clef maîtresse, rien ne part : le carnet est chiffré avec elle.
    canSync: () => Boolean(loadSession()) && Boolean(masterKey()),
    onResult: (outcome: SyncRun<SyncOutcome>) => {
      if ("skipped" in outcome) return;
      lastSyncFailure.value = outcome.ok ? null : syncFailureCode(outcome.error);
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
 * Branche la page sur la synchronisation automatique : elle prête sa clef
 * maîtresse, reçoit ce qui a changé, et synchronise à son ouverture.
 */
export function useAutoSync(key: Ref<string>, onSynced?: Listener) {
  const mine = { key, onSynced };
  onMounted(() => {
    lender = mine;
    if (loadSession() && masterKey()) autoSync.triggerOpen();
  });
  onUnmounted(() => {
    if (lender === mine) lender = null;
  });
  return {
    /** Quand la clef vient d'être saisie : compte comme une ouverture. */
    keyEntered() {
      if (loadSession() && masterKey()) autoSync.triggerOpen();
    },
  };
}

/** Pour les tests : l'espacement des ouvertures ne survit pas d'un test à l'autre. */
export function resetAutoSyncForTests(): void {
  autoSync.cancel();
  autoSync = build();
  lender = null;
  lastSyncFailure.value = null;
}
