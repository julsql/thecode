package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.concurrent.Executor;

/**
 * Quand lancer la synchronisation automatique (shared/spec/vault-sync.md,
 * « Synchronisation automatique »).
 *
 * Sans Android : l'horloge, la minuterie et le fil d'exécution sont injectés,
 * ce qui rend les règles vérifiables en test.
 *
 * - les demandes rapprochées sont fusionnées : on attend {@link #DEBOUNCE_MS}
 *   après la dernière ;
 * - une synchronisation en cours n'est jamais doublée : une demande pendant
 *   qu'elle tourne en relance une seule après ;
 * - à l'ouverture, pas plus d'une fois toutes les {@link #OPEN_THROTTLE_MS} ;
 * - rien ne part tant que {@link #ready} est faux (pas de compte, pas de clef).
 */
public final class SyncScheduler {

    public static final long DEBOUNCE_MS = 2_000;
    public static final long OPEN_THROTTLE_MS = 30_000;

    /** Horloge en millisecondes. */
    public interface Clock {
        long now();
    }

    /** Minuterie : lance une tâche après un délai, annulable. */
    public interface Timer {
        @NonNull
        Cancellable schedule(@NonNull Runnable task, long delayMs);
    }

    public interface Cancellable {
        void cancel();
    }

    /** Condition de départ : un compte lié et une clef maîtresse. */
    public interface Ready {
        boolean isReady();
    }

    private final Clock clock;
    private final Timer timer;
    private final Executor worker;
    private final Ready ready;
    private final Runnable task;

    @Nullable
    private Cancellable pending;
    private boolean running;
    private boolean rerun;
    private long lastOpenAt;
    private boolean opened;

    /**
     * @param task la synchronisation, exécutée sur {@code worker} ; ses échecs
     *             sont les siens, une exception n'arrête pas l'ordonnanceur
     */
    public SyncScheduler(@NonNull Clock clock, @NonNull Timer timer, @NonNull Executor worker,
                         @NonNull Ready ready, @NonNull Runnable task) {
        this.clock = clock;
        this.timer = timer;
        this.worker = worker;
        this.ready = ready;
        this.task = task;
    }

    /** Ouverture ou retour au premier plan : espacé de 30 secondes. */
    public synchronized void onOpen() {
        if (!ready.isReady()) return;
        long now = clock.now();
        if (opened && now - lastOpenAt < OPEN_THROTTLE_MS) return;
        opened = true;
        lastOpenAt = now;
        debounce();
    }

    /** Écriture locale ou réglage modifié : regroupé avec les suivants. */
    public synchronized void onChange() {
        if (!ready.isReady()) return;
        debounce();
    }

    /**
     * Toute écriture locale du carnet ({@link Vault#save}) relance la
     * synchronisation ; celles de la synchronisation elle-même
     * ({@link Vault#saveSynced}) non.
     */
    public void watchVaultWrites() {
        Vault.setWriteListener(this::onChange);
    }

    /** Bouton « Synchroniser » : tout de suite, sans jamais doubler une en cours. */
    public synchronized void runNow() {
        if (!ready.isReady()) return;
        cancelPending();
        start();
    }

    /** Vrai tant qu'une synchronisation tourne. */
    public synchronized boolean isRunning() {
        return running;
    }

    private void debounce() {
        cancelPending();
        pending = timer.schedule(this::fire, DEBOUNCE_MS);
    }

    private void cancelPending() {
        if (pending != null) {
            pending.cancel();
            pending = null;
        }
    }

    private synchronized void fire() {
        pending = null;
        start();
    }

    private void start() {
        if (running) {
            rerun = true;
            return;
        }
        running = true;
        worker.execute(() -> {
            try {
                if (ready.isReady()) task.run();
            } finally {
                finished();
            }
        });
    }

    private synchronized void finished() {
        running = false;
        if (rerun) {
            rerun = false;
            start();
        }
    }
}
