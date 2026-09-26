package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import fr.juliette.thecode.SessionLock;

/**
 * Verrou de l'écran carnet (shared/spec/vault-lock.md).
 *
 * Protège l'écran, pas les données : le remplissage et la génération lisent le
 * carnet sans passer par ici.
 *
 * Une seule session avec la clef ({@link SessionLock}) : une session valide
 * ouvre l'écran sans rien demander, et déverrouiller le carnet déverrouille la
 * clef. Quitter l'écran ouvert fait courir la fenêtre commune ; verrouiller ou
 * oublier y met fin pour les deux. La méthode propre au carnet (biométrie ou
 * mot de passe) ne sert qu'à défaut de session valide.
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

    public static final String BIOMETRIC = "biometric";
    public static final String PASSWORD = "password";

    private final Store store;
    private final SessionLock session;
    private volatile boolean unlocked;

    /** Une session valide (clef ou carnet déverrouillé récemment) ouvre l'écran. */
    public VaultLock(@NonNull Store store, @NonNull SessionLock session) {
        this.store = store;
        this.session = session;
        this.unlocked = sessionOpens();
    }

    private boolean sessionOpens() {
        return method() != Method.NONE && session.isValid();
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

    /** Ouvre l'écran et la session commune : la clef est déverrouillée aussi. */
    private void open() {
        unlocked = true;
        session.stamp();
    }

    /** Choisir la biométrie : à la première ouverture ou depuis l'écran déverrouillé. */
    public void chooseBiometric() {
        requireConfigurable();
        store.setPasswordRecord(null);
        store.setMethod(BIOMETRIC);
        open();
    }

    /**
     * Choisir un mot de passe de carnet, déjà haché ({@link VaultPassword#hash})
     * hors du fil de l'interface.
     */
    public void choosePassword(@NonNull String record) {
        requireConfigurable();
        store.setPasswordRecord(record);
        store.setMethod(PASSWORD);
        open();
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
        open();
    }

    /** Remplace le mot de passe ; l'actuel a été vérifié par l'appelant. */
    public void changePassword(@NonNull String newRecord) {
        if (state() != State.UNLOCKED || method() != Method.PASSWORD) {
            throw new IllegalStateException("Changement de mot de passe hors session");
        }
        store.setPasswordRecord(newRecord);
    }

    /** Verrou explicite : referme l'écran et met fin à la session, clef comprise. */
    public void lock() {
        unlocked = false;
        session.invalidate();
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
     * si l'écran était ouvert, la fenêtre commune part de maintenant. Pendant
     * notre propre invite, l'écran du code de l'appareil fait quitter
     * l'activité : la décision est différée jusqu'à l'issue de l'auth.
     */
    public void onLeave() {
        if (isUnlocked()) session.stamp();
        if (systemAuthInProgress) lockDeferred = true;
    }

    /**
     * Retour sur l'écran : l'état suit la session commune. Au-delà de la
     * fenêtre (ou horloge reculée), l'écran se referme ; une session ouverte
     * entre-temps par la clef l'ouvre. Sans effet pendant une auth système,
     * dont l'issue tranchera ({@link #endSystemAuth}).
     *
     * @return vrai si le verrou vient d'être appliqué.
     */
    public boolean onReturn() {
        if (systemAuthInProgress) return false;
        return resolveSession();
    }

    /**
     * Fin de l'auth système, dans chaque rappel. Si l'écran a été quitté
     * pendant l'invite, un succès lève la question (l'appelant déverrouille),
     * un échec (annulation, mise en arrière-plan) applique la fenêtre.
     *
     * @return vrai si l'écran vient d'être reverrouillé.
     */
    public boolean endSystemAuth(boolean success) {
        boolean deferred = lockDeferred;
        systemAuthInProgress = false;
        lockDeferred = false;
        if (!deferred || success) return false;
        return resolveSession();
    }

    /** Aligne l'écran sur la session commune, et la relance si elle court. */
    private boolean resolveSession() {
        boolean wasUnlocked = unlocked;
        unlocked = sessionOpens();
        if (unlocked) session.stamp();
        return wasUnlocked && !unlocked;
    }

    /**
     * Oubli : efface le verrou et met fin à la session, clef comprise.
     * L'appelant efface aussi le carnet local — rien d'autre ne permet de
     * passer le verrou.
     */
    public void forget() {
        store.clear();
        session.invalidate();
        unlocked = false;
    }

    private void requireConfigurable() {
        if (state() == State.LOCKED) {
            throw new IllegalStateException("Changer de méthode exige un carnet déverrouillé");
        }
    }
}
