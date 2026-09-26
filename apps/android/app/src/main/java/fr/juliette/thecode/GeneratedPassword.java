package fr.juliette.thecode;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import fr.juliette.thecode.vault.Vault;

/**
 * Affichage du mot de passe généré et libellé du bouton qui l'enregistre.
 *
 * Pur, sans vue : testable sans Android.
 */
final class GeneratedPassword {

    /**
     * Masque affiché à la place du mot de passe. Longueur fixe : des points
     * en nombre égal aux caractères trahiraient la longueur choisie.
     */
    static final String MASK = "••••••••••••";

    private GeneratedPassword() {}

    /** Ce que montre le champ : rien, le masque, ou le mot de passe en clair. */
    @NonNull
    static String display(@Nullable String password, boolean revealed) {
        if (password == null || password.isEmpty()) return "";
        return revealed ? password : MASK;
    }

    /**
     * Vrai quand le compte (domaine et identifiant) a déjà son entrée : le
     * bouton la met à jour au lieu d'en créer une.
     */
    static boolean hasEntry(@Nullable Vault vault, @Nullable String site, @Nullable String login) {
        if (vault == null || site == null) return false;
        String domain = site.trim();
        if (domain.isEmpty()) return false;
        return vault.findAccount(domain, Vault.loginOf(login).trim()) != null;
    }
}
