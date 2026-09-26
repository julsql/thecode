package fr.juliette.thecode;

import androidx.annotation.NonNull;

/**
 * Fenêtre de grâce pendant laquelle une authentification reste valide, y
 * compris après que l'app a été quittée : l'horodatage vit dans les
 * {@link Preferences} et non dans le process. Même principe que le
 * gestionnaire de mots de passe d'Apple — on ne redemande l'auth que si l'app
 * est restée hors du premier plan plus longtemps que la fenêtre.
 *
 * Une seule session pour la clef et le carnet (shared/spec/vault-lock.md,
 * « Apps : une seule session avec la clef ») : déverrouiller l'un ouvre
 * l'autre, et la fenêtre est commune.
 */
public final class SessionLock {

    /** Durée de validité d'une auth après le dernier passage au premier plan. */
    public static final long GRACE_MILLIS = 3 * 60 * 1000L;

    /** Stockage de l'horodatage (epoch ms, 0 si aucun). Aucun secret n'y vit. */
    public interface Store {
        long stampedAt();
        void setStampedAt(long at);
        void clear();
    }

    /** Horloge injectable pour les tests. */
    public interface Clock {
        long now();
    }

    private final Store store;
    private final Clock clock;

    public SessionLock(@NonNull Preferences preferences) {
        this(new Store() {
            @Override public long stampedAt() { return preferences.getLastUnlockAt(); }
            @Override public void setStampedAt(long at) { preferences.setLastUnlockAt(at); }
            @Override public void clear() { preferences.clearLastUnlockAt(); }
        }, System::currentTimeMillis);
    }

    public SessionLock(@NonNull Store store, @NonNull Clock clock) {
        this.store = store;
        this.clock = clock;
    }

    /**
     * Horodate l'instant de référence : à chaque auth réussie (clef ou
     * carnet), et à chaque fois qu'un écran ouvert quitte le premier plan
     * (c'est ce dernier point qui fait courir la fenêtre à partir de la mise
     * en fond).
     */
    public void stamp() {
        store.setStampedAt(clock.now());
    }

    /** Invalide la session : la prochaine ouverture exigera une auth. */
    public void invalidate() {
        store.clear();
    }

    /**
     * {@code true} si le dernier horodatage est encore dans la fenêtre de
     * grâce. Un horodatage dans le futur (horloge reculée) invalide la session
     * plutôt que de la prolonger indéfiniment.
     */
    public boolean isValid() {
        return isWithinGrace(store.stampedAt(), clock.now());
    }

    /**
     * Logique pure du verrou, isolée du stockage et de l'horloge pour être
     * testable. Un horodatage nul (jamais authentifié) ou situé dans le futur
     * (horloge reculée) n'est pas valide.
     */
    public static boolean isWithinGrace(long stampedAt, long now) {
        if (stampedAt <= 0L) return false;
        long elapsed = now - stampedAt;
        return elapsed >= 0L && elapsed <= GRACE_MILLIS;
    }
}
