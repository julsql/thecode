package fr.juliette.thecode.autofill;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import fr.juliette.thecode.vault.SiteResolution;

/**
 * Quel identifiant écrire dans le champ identifiant du formulaire au moment du
 * remplissage.
 *
 * Le mot de passe dépend de l'identifiant (v2) : le formulaire soumis doit
 * porter celui qui a servi au calcul. On remplit donc l'identifiant du compte
 * choisi quand le champ est vide, ou qu'il le contient déjà (valeur inchangée).
 * Un autre identifiant déjà tapé n'est jamais écrasé : il désigne un autre
 * compte, et c'est pour lui que le mot de passe est calculé
 * ({@link SiteResolution#forPageLogin}). Un compte sans identifiant (repli, ou
 * entrée enregistrée sans) ne touche pas au champ.
 */
public final class UsernameFill {

    private UsernameFill() {}

    /**
     * @param accountLogin identifiant du compte choisi ({@link SiteResolution#login})
     * @param pageLogin    valeur actuelle du champ identifiant de la page
     * @return l'identifiant à écrire, ou {@code null} pour laisser le champ tel quel
     */
    @Nullable
    public static String loginToFill(@Nullable String accountLogin, @Nullable String pageLogin) {
        String account = SiteResolution.normalizeLogin(accountLogin);
        if (account.isEmpty()) return null;
        String typed = SiteResolution.normalizeLogin(pageLogin);
        if (typed.isEmpty() || typed.equals(account)) return account;
        return null;
    }

    /** Raccourci pour une résolution du carnet. */
    @Nullable
    public static String loginToFill(@NonNull SiteResolution resolution,
                                     @Nullable String pageLogin) {
        return loginToFill(resolution.login, pageLogin);
    }
}
