package fr.juliette.thecode.autofill;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

/**
 * Identifiant saisi dans la fenêtre du remplissage automatique, gardé le temps
 * que le formulaire soit envoyé.
 *
 * Quand la page n'a pas de champ identifiant reconnu, l'enregistrement ne
 * reçoit du système que le mot de passe : sans ce rappel, il ne saurait pas
 * avec quel identifiant il a été calculé et le refuserait. En mémoire
 * seulement, pour un site, et pour peu de temps.
 */
final class TypedLoginHint {

    static final long VALID_MS = 10 * 60 * 1000;

    @Nullable
    private static String domain;
    @Nullable
    private static String login;
    private static long at;

    private TypedLoginHint() { }

    static synchronized void remember(@NonNull String forDomain, @NonNull String typed, long now) {
        domain = forDomain;
        login = typed;
        at = now;
    }

    /** L'identifiant saisi pour ce site, ou {@code null} s'il n'y en a pas ou plus. */
    @Nullable
    static synchronized String recall(@NonNull String forDomain, long now) {
        if (login == null || !forDomain.equals(domain)) return null;
        long age = now - at;
        return age >= 0 && age <= VALID_MS ? login : null;
    }

    static synchronized void forget() {
        domain = null;
        login = null;
    }
}
