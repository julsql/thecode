package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

/**
 * Verrou de l'écran carnet (shared/spec/vault-lock.md).
 *
 * Protège l'écran, pas les données : le remplissage et la génération lisent le
 * carnet sans passer par ici. Déverrouillé en mémoire seulement : aucune
 * session n'est mémorisée, l'activité reverrouille dès qu'on la quitte.
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
    private volatile boolean unlocked = false;

    public VaultLock(@NonNull Store store) {
        this.store = store;
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

    public void lock() {
        unlocked = false;
    }

    /**
     * Oubli : efface le verrou. L'appelant efface aussi le carnet local — rien
     * d'autre ne permet de passer le verrou.
     */
    public void forget() {
        store.clear();
        unlocked = false;
    }

    private void requireConfigurable() {
        if (state() == State.LOCKED) {
            throw new IllegalStateException("Changer de méthode exige un carnet déverrouillé");
        }
    }
}
