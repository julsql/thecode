package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import fr.juliette.thecode.SessionLock;

/**
 * Verrou de l'écran carnet (shared/spec/vault-lock.md).
 *
 * Protège l'écran, pas les données : le remplissage et la génération lisent le
 * carnet sans passer par ici. Déverrouillé tant qu'on est sur l'écran ; en le
 * quittant, seul l'instant de sortie est retenu ({@link Session}) : revenu
 * dans la fenêtre de grâce de la clef ({@link SessionLock#GRACE_MILLIS}),
 * l'écran est toujours ouvert, y compris dans une nouvelle instance.
 *
 * Logique pure, le stockage est injecté pour être testable sans Android.
 */
public final class VaultLock {

    public enum Method { NONE, BIOMETRIC, PASSWORD }

    public enum State {
        /** Aucune méthode choisie : première ouverture, ou après un oubli. */
        SETUP,
        LOCKED,
        UNLOCKED
    }

    /** Stockage local de la méthode et de l'empreinte. Jamais synchronisé. */
    public interface Store {
        @NonNull String method();
        void setMethod(@NonNull String method);
        @Nullable String passwordRecord();
        void setPasswordRecord(@Nullable String record);
        void clear();
    }

    /**
     * Instant de sortie d'un écran déverrouillé (epoch ms, 0 si aucun). Un
     * simple horodatage, hors du stockage chiffré : aucun secret n'y vit.
     */
    public interface Session {
        long leftAt();
        void setLeftAt(long at);
        void clear();
    }

    /** Horloge injectable pour les tests. */
    public interface Clock {
        long now();
    }

    public static final String BIOMETRIC = "biometric";
    public static final String PASSWORD = "password";

    private final Store store;
    private final Session session;
    private final Clock clock;
    private volatile boolean unlocked;

    /**
     * L'état initial se déduit de l'instant de sortie retenu : un écran
     * recréé dans la fenêtre de grâce reste ouvert.
     */
    public VaultLock(@NonNull Store store, @NonNull Session session, @NonNull Clock clock) {
        this.store = store;
        this.session = session;
        this.clock = clock;
        this.unlocked = withinGrace();
    }

    private boolean withinGrace() {
        return method() != Method.NONE
                && SessionLock.isWithinGrace(session.leftAt(), clock.now());
    }

    @NonNull
    public Method method() {
        String m = store.method();
        if (BIOMETRIC.equals(m)) return Method.BIOMETRIC;
        if (PASSWORD.equals(m)) return Method.PASSWORD;
        return Method.NONE;
    }

    @NonNull
    public State state() {
        if (method() == Method.NONE) return State.SETUP;
        return unlocked ? State.UNLOCKED : State.LOCKED;
    }

    public boolean isUnlocked() {
        return state() == State.UNLOCKED;
    }

    /** Choisir la biométrie : à la première ouverture ou depuis l'écran déverrouillé. */
    public void chooseBiometric() {
        requireConfigurable();
        store.setPasswordRecord(null);
        store.setMethod(BIOMETRIC);
        unlocked = true;
    }

    /**
     * Choisir un mot de passe de carnet, déjà haché ({@link VaultPassword#hash})
     * hors du fil de l'interface.
     */
    public void choosePassword(@NonNull String record) {
        requireConfigurable();
        store.setPasswordRecord(record);
        store.setMethod(PASSWORD);
        unlocked = true;
    }

    /** Coûteux (PBKDF2) : à appeler hors du fil de l'interface. */
    public boolean verifyPassword(@NonNull char[] password) {
        return method() == Method.PASSWORD
                && VaultPassword.verify(password, store.passwordRecord());
    }

    /** Déverrouille après une vérification réussie ou un succès biométrique. */
    public void unlock(@NonNull Method with) {
        if (with == Method.NONE || with != method()) {
            throw new IllegalStateException("Méthode " + with + " non configurée");
        }
        unlocked = true;
    }

    /** Remplace le mot de passe ; l'actuel a été vérifié par l'appelant. */
    public void changePassword(@NonNull String newRecord) {
        if (state() != State.UNLOCKED || method() != Method.PASSWORD) {
            throw new IllegalStateException("Changement de mot de passe hors session");
        }
        store.setPasswordRecord(newRecord);
    }

    /** Verrou explicite : referme l'écran et oublie la fenêtre de grâce. */
    public void lock() {
        unlocked = false;
        session.clear();
    }

    /** Vrai pendant une auth système lancée par l'écran (biométrie, code de l'appareil). */
    private boolean systemAuthInProgress = false;
    /** L'écran a été quitté pendant cette auth : reverrouiller si elle échoue. */
    private boolean lockDeferred = false;

    /** À appeler juste avant d'afficher l'invite biométrique. */
    public void beginSystemAuth() {
        systemAuthInProgress = true;
        lockDeferred = false;
    }

    public boolean isSystemAuthInProgress() {
        return systemAuthInProgress;
    }

    /**
     * Sortie de l'écran (arrière-plan, retour, fermeture). Ne verrouille pas :
     * retient l'instant de sortie si l'écran était ouvert, pour le rouvrir
     * sans auth dans la fenêtre de grâce. Pendant notre propre invite, l'écran
     * du code de l'appareil fait quitter l'activité : la décision est
     * différée jusqu'à l'issue de l'auth.
     */
    public void onLeave() {
        if (isUnlocked()) {
            session.setLeftAt(clock.now());
        } else {
            session.clear();
        }
        if (systemAuthInProgress) lockDeferred = true;
    }

    /**
     * Retour sur l'écran : au-delà de la fenêtre de grâce (ou horloge
     * reculée), l'écran se referme. Sans effet pendant une auth système, dont
     * l'issue tranchera ({@link #endSystemAuth}).
     *
     * @return vrai si le verrou vient d'être appliqué.
     */
    public boolean onReturn() {
        if (systemAuthInProgress) return false;
        return resolveSession();
    }

    /**
     * Fin de l'auth système, dans chaque rappel. Si l'écran a été quitté
     * pendant l'invite, un succès lève la question, un échec (annulation,
     * mise en arrière-plan) applique la fenêtre de grâce.
     *
     * @return vrai si l'écran vient d'être reverrouillé.
     */
    public boolean endSystemAuth(boolean success) {
        boolean deferred = lockDeferred;
        systemAuthInProgress = false;
        lockDeferred = false;
        if (!deferred) return false;
        if (success) {
            session.clear();
            return false;
        }
        return resolveSession();
    }

    /** Applique puis efface l'instant de sortie retenu, s'il y en a un. */
    private boolean resolveSession() {
        if (session.leftAt() <= 0L) return false;
        boolean wasUnlocked = unlocked;
        unlocked = unlocked && withinGrace();
        session.clear();
        return wasUnlocked && !unlocked;
    }

    /**
     * Oubli : efface le verrou. L'appelant efface aussi le carnet local — rien
     * d'autre ne permet de passer le verrou.
     */
    public void forget() {
        store.clear();
        session.clear();
        unlocked = false;
    }

    private void requireConfigurable() {
        if (state() == State.LOCKED) {
            throw new IllegalStateException("Changer de méthode exige un carnet déverrouillé");
        }
    }
}
