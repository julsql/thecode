package fr.juliette.thecode;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.MainThread;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import fr.juliette.thecode.vault.DefaultSettings;
import fr.juliette.thecode.vault.Sync;
import fr.juliette.thecode.vault.SyncScheduler;
import fr.juliette.thecode.vault.Vault;
import fr.juliette.thecode.vault.VaultEntry;

/**
 * Synchronisation du carnet puis des réglages par défaut, partagée par tout
 * le processus (shared/spec/vault-sync.md, « Synchronisation automatique »).
 *
 * Lancée à l'ouverture, après chaque écriture du carnet et après chaque
 * changement de réglage par défaut ; {@link SyncScheduler} décide quand. Un
 * échec ne montre rien : il laisse un statut court, lu par l'écran du carnet.
 * Seul le bouton « Synchroniser » ({@link #syncNow()}) rend compte à voix haute.
 */
public final class AutoSync {

    private static final String TAG = "TheCode";

    /** Fin d'une synchronisation, livrée sur le fil principal. */
    public static final class Outcome {
        /** Lancée par le bouton « Synchroniser ». */
        public final boolean manual;
        public final boolean ok;
        /** Les réglages par défaut ont été remplacés par ceux du compte. */
        public final boolean settingsChanged;
        /** Texte à montrer pour une synchronisation manuelle. */
        @NonNull
        public final String message;

        Outcome(boolean manual, boolean ok, boolean settingsChanged, @NonNull String message) {
            this.manual = manual;
            this.ok = ok;
            this.settingsChanged = settingsChanged;
            this.message = message;
        }
    }

    public interface Listener {
        @MainThread
        void onSyncStatus(@NonNull String status);

        @MainThread
        void onSyncFinished(@NonNull Outcome outcome);
    }

    @Nullable
    private static AutoSync instance;

    private final Context app;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final List<Listener> listeners = new CopyOnWriteArrayList<>();
    private final AtomicBoolean manualRequested = new AtomicBoolean();
    private final SyncScheduler scheduler;
    @Nullable
    private Preferences preferences;
    @Nullable
    private volatile String status;

    private AutoSync(Context context) {
        app = context.getApplicationContext();
        scheduler = new SyncScheduler(
                SystemClock::elapsedRealtime,
                (task, delayMs) -> {
                    main.postDelayed(task, delayMs);
                    return () -> main.removeCallbacks(task);
                },
                worker,
                this::isReady,
                this::runOnce);
    }

    @NonNull
    public static synchronized AutoSync get(@NonNull Context context) {
        if (instance == null) instance = new AutoSync(context);
        return instance;
    }

    /**
     * Branche les déclencheurs d'écriture : tout {@link Vault#save} et tout
     * réglage par défaut modifié, d'où qu'ils viennent (écrans, remplissage
     * automatique, import).
     */
    public static void install(@NonNull Context context) {
        AutoSync sync = get(context);
        sync.scheduler.watchVaultWrites();
        Preferences.setSettingsListener(sync.scheduler::onChange);
    }

    /** Ouverture de l'app ou d'un écran, retour au premier plan. */
    public void onOpen() {
        scheduler.onOpen();
    }

    /** Bouton « Synchroniser ». */
    public void syncNow() {
        manualRequested.set(true);
        scheduler.runNow();
    }

    /** Dernier statut connu, {@code null} tant que rien n'a tourné. */
    @Nullable
    public String status() {
        return status;
    }

    public void addListener(@NonNull Listener listener) {
        listeners.add(listener);
    }

    public void removeListener(@NonNull Listener listener) {
        listeners.remove(listener);
    }

    private synchronized Preferences preferences() {
        if (preferences == null) preferences = new Preferences(app);
        return preferences;
    }

    /** Sans clef maîtresse, rien ne part : le carnet est chiffré avec elle. */
    private boolean isReady() {
        Preferences prefs = preferences();
        return prefs.getSyncCredentials() != null && !prefs.getEncodingKey().isEmpty();
    }

    // ------------------------------------------------------------- routine

    /** Sur le fil de travail, jamais deux à la fois ({@link SyncScheduler}). */
    private void runOnce() {
        boolean manual = manualRequested.getAndSet(false);
        Preferences prefs = preferences();
        String masterKey = prefs.getEncodingKey();
        Sync.Credentials credentials = prefs.getSyncCredentials();
        if (masterKey.isEmpty() || credentials == null) return;

        publishStatus(app.getString(R.string.sync_running));
        try {
            Sync sync = new Sync();
            Vault local = Vault.load(app);
            Sync.Result result = sync.syncRenewing(local, masterKey, credentials);
            // Un abonnement pris ou arrêté entre-temps doit se voir sans se
            // reconnecter.
            Sync.Credentials withPlan = sync.accountPlan(result.credentials);
            // Les jetons peuvent avoir été renouvelés pendant l'appel : ne pas
            // les réenregistrer forcerait une reconnexion. Sauf compte délié
            // entre-temps.
            if (prefs.getSyncCredentials() != null) prefs.setSyncCredentials(withPlan);
            boolean settingsChanged = syncDefaultSettings(prefs, sync, masterKey, withPlan);
            Vault saved = writeBack(local, result.vault);

            int kept = -result.localOnly;
            for (VaultEntry entry : saved.entries) {
                if (!entry.deleted) kept++;
            }
            String done = result.conflicts.isEmpty()
                    ? app.getString(R.string.sync_done, kept)
                    : app.getString(R.string.sync_done_conflicts, kept, result.conflicts.size());
            // Au-delà du plafond, le reste ne part pas : le dire, sinon on
            // croit retrouver sur l'autre appareil ce qui n'y est jamais allé.
            String localOnly = result.localOnly == 0 ? ""
                    : " " + app.getString(R.string.sync_local_only, result.localOnly);
            String time = android.text.format.DateFormat.getTimeFormat(app)
                    .format(new java.util.Date());
            publishStatus(app.getString(R.string.sync_status_done, time) + localOnly);
            finish(new Outcome(manual, true, settingsChanged, done + localOnly));
        } catch (Sync.SyncException e) {
            // 402 : le serveur explique comment lever la limite, ce qu'une app
            // du Store n'a pas le droit de relayer. On garde le fait, pas
            // l'invitation. Les données locales ne sont pas touchées.
            String message = e.status == 402
                    ? app.getString(R.string.sync_limit_reached)
                    : app.getString(R.string.sync_failed, e.getMessage());
            Log.w(TAG, "Synchronisation impossible : " + e.getMessage());
            publishStatus(message);
            finish(new Outcome(manual, false, false, message));
        }
    }

    /**
     * Enregistre le résultat. Si le carnet a été écrit pendant l'appel, on
     * fusionne au lieu d'écraser : l'écriture locale a déjà demandé une
     * nouvelle synchronisation, qui la poussera.
     */
    private Vault writeBack(Vault loaded, Vault synced) {
        synchronized (Vault.WRITE_LOCK) {
            Vault current = Vault.load(app);
            Vault toSave = synced;
            if (!sameContent(current, loaded)) {
                toSave = Vault.merge(current, synced, new ArrayList<>());
            }
            // Écriture disque ici et non sur le fil principal : la
            // synchronisation peut rapporter des centaines d'entrées.
            toSave.saveSynced(app);
            return toSave;
        }
    }

    private static boolean sameContent(Vault a, Vault b) {
        try {
            return a.toJson().equals(b.toJson());
        } catch (JSONException e) {
            return false;
        }
    }

    /**
     * Réglages par défaut, après le carnet. Un échec ici n'annule pas la
     * synchronisation du carnet, déjà faite : on retentera la prochaine fois.
     *
     * @return vrai si les réglages locaux ont été remplacés
     */
    private static boolean syncDefaultSettings(Preferences prefs, Sync sync, String masterKey,
                                               Sync.Credentials credentials) {
        DefaultSettings local = prefs.getDefaultSettings();
        try {
            DefaultSettings kept = sync.syncSettings(local, masterKey, credentials);
            if (kept == local) return false;
            prefs.applyDefaultSettings(kept);
            return true;
        } catch (Sync.SyncException e) {
            Log.w(TAG, "Réglages non synchronisés : " + e.getMessage());
            return false;
        }
    }

    private void publishStatus(String text) {
        status = text;
        main.post(() -> {
            for (Listener listener : listeners) listener.onSyncStatus(text);
        });
    }

    private void finish(Outcome outcome) {
        main.post(() -> {
            for (Listener listener : listeners) listener.onSyncFinished(outcome);
        });
    }
}
