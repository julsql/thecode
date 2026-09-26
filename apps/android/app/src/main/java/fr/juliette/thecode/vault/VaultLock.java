package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import fr.juliette.thecode.SessionLock;

/**
 * Verrou de l'écran carnet.
 *
 * Protège l'écran, pas les données : le remplissage et la génération lisent le
 * carnet sans passer par ici.
 *
 * Aucun secret propre au carnet : il s'ouvre par la biométrie de l'appareil
 * quand elle est disponible, sinon en ressaisissant la clef maîtresse déjà
 * enregistrée. Rien à choisir, rien à mettre en place, rien à oublier.
 *
 * Une seule session avec la clef ({@link SessionLock}) : une session valide
 * ouvre l'écran sans rien demander, et déverrouiller le carnet déverrouille la
 * clef. Quitter l'écran ouvert fait courir la fenêtre commune ; verrouiller y
 * met fin pour les deux.
 *
 * Logique pure, la clef est injectée pour être testable sans Android.
 */
public final class VaultLock {

    public enum State { LOCKED, UNLOCKED }

    /** Issue d'une saisie de la clef maîtresse. */
    public enum KeyCheck {
        OK,
        /** Ce n'est pas la clef enregistrée sur cet appareil. */
        MISMATCH,
        /** Aucune clef enregistrée : la définir d'abord sur l'écran principal. */
        NO_KEY
    }

    /** La clef maîtresse enregistrée (Keystore), vide si aucune. */
    public interface MasterKey {
        @Nullable String stored();
    }

    private final MasterKey masterKey;
    private final SessionLock session;
    private volatile boolean unlocked;

    /** Une session valide (clef ou carnet déverrouillé récemment) ouvre l'écran. */
    public VaultLock(@NonNull MasterKey masterKey, @NonNull SessionLock session) {
        this.masterKey = masterKey;
        this.session = session;
        this.unlocked = session.isValid();
    }

    @NonNull
    public State state() {
        return unlocked ? State.UNLOCKED : State.LOCKED;
    }

    public boolean isUnlocked() {
        return unlocked;
    }

    /** Vrai si une clef maîtresse est enregistrée, donc si la saisie peut ouvrir. */
    public boolean hasMasterKey() {
        String stored = masterKey.stored();
        return stored != null && !stored.isEmpty();
    }

    /** Ouvre l'écran et la session commune : la clef est déverrouillée aussi. */
    private void open() {
        unlocked = true;
        session.stamp();
    }

    /** Succès de l'invite biométrique (ou du code de l'appareil qu'elle propose). */
    public void unlockWithBiometrics() {
        open();
    }

    /**
     * Compare la saisie à la clef enregistrée, en temps constant, et ouvre
     * l'écran si elles concordent.
     */
    @NonNull
    public KeyCheck unlockWithKey(@NonNull String typed) {
        String stored = masterKey.stored();
        if (stored == null || stored.isEmpty()) return KeyCheck.NO_KEY;
        if (!matches(typed, stored)) return KeyCheck.MISMATCH;
        open();
        return KeyCheck.OK;
    }

    /** Temps constant : ne rien laisser deviner de la clef par la durée. */
    static boolean matches(@NonNull String typed, @NonNull String stored) {
        return MessageDigest.isEqual(typed.getBytes(StandardCharsets.UTF_8),
                stored.getBytes(StandardCharsets.UTF_8));
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
        if (unlocked) session.stamp();
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
        unlocked = session.isValid();
        if (unlocked) session.stamp();
        return wasUnlocked && !unlocked;
    }
}
