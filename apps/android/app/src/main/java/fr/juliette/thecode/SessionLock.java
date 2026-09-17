package fr.juliette.thecode;

/**
 * Fenêtre de grâce pendant laquelle une authentification biométrique reste
 * valide, y compris après que l'app a été quittée : l'horodatage vit dans les
 * {@link Preferences} et non dans le process. Même principe que le
 * gestionnaire de mots de passe d'Apple — on ne redemande la biométrie que si
 * l'app est restée hors du premier plan plus longtemps que la fenêtre.
 */
public final class SessionLock {

    /** Durée de validité d'une auth après le dernier passage au premier plan. */
    public static final long GRACE_MILLIS = 3 * 60 * 1000L;

    private final Preferences preferences;

    public SessionLock(Preferences preferences) {
        this.preferences = preferences;
    }

    /**
     * Horodate l'instant de référence : à chaque auth réussie, et à chaque fois
     * que l'app quitte le premier plan avec une session valide (c'est ce
     * dernier point qui fait courir la fenêtre à partir de la mise en fond).
     */
    public void stamp() {
        preferences.setLastUnlockAt(System.currentTimeMillis());
    }

    /** Invalide la session : la prochaine ouverture exigera une auth. */
    public void invalidate() {
        preferences.clearLastUnlockAt();
    }

    /**
     * {@code true} si le dernier horodatage est encore dans la fenêtre de
     * grâce. Un horodatage dans le futur (horloge reculée) invalide la session
     * plutôt que de la prolonger indéfiniment.
     */
    public boolean isValid() {
        return isWithinGrace(preferences.getLastUnlockAt(), System.currentTimeMillis());
    }

    /**
     * Logique pure du verrou, isolée du stockage et de l'horloge pour être
     * testable. Un horodatage nul (jamais authentifié) ou situé dans le futur
     * (horloge reculée) n'est pas valide.
     */
    static boolean isWithinGrace(long stampedAt, long now) {
        if (stampedAt <= 0L) return false;
        long elapsed = now - stampedAt;
        return elapsed >= 0L && elapsed <= GRACE_MILLIS;
    }
}
