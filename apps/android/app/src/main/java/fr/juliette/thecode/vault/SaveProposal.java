package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

/**
 * Quand proposer d'enregistrer un site au carnet, et sous quel identifiant.
 *
 * Même règle pour l'écran de génération et pour le remplissage automatique :
 * on ne propose que lorsqu'un compte de synchronisation est lié (le carnet a
 * alors une raison d'exister au-delà de l'appareil) et que le carnet ne
 * connaît pas encore le site. Déjà connu, la question serait du bruit.
 */
public final class SaveProposal {

    private SaveProposal() {}

    /** Mot de passe v2 que donnerait ce site pour un identifiant donné. */
    public interface Deriver {
        @NonNull
        String passwordFor(@NonNull String login);
    }

    public static boolean shouldPropose(boolean syncLinked, @NonNull Vault vault,
                                        @Nullable String domain) {
        if (!syncLinked || domain == null) return false;
        String site = domain.trim();
        return !site.isEmpty() && vault.findAllByDomain(site).isEmpty();
    }

    /**
     * L'identifiant à enregistrer pour un mot de passe soumis.
     *
     * L'identifiant entre dans la dérivation v2 : l'enregistrer tel quel
     * changerait le mot de passe d'un compte dont le mot de passe a été rempli
     * sans identifiant (c'est ce que fait le remplissage d'un site inconnu). On
     * garde donc celui qui redonne le mot de passe soumis ; si aucun ne le
     * redonne, le mot de passe ne vient pas de TheCode et on garde le compte
     * tel qu'il a été saisi.
     */
    @NonNull
    public static String loginToStore(@Nullable String submittedPassword,
                                      @Nullable String username, @NonNull Deriver deriver) {
        String user = username == null ? "" : username.trim();
        if (submittedPassword == null || submittedPassword.isEmpty()) return user;
        if (!user.isEmpty() && submittedPassword.equals(deriver.passwordFor(user))) return user;
        if (submittedPassword.equals(deriver.passwordFor(""))) return "";
        return user;
    }
}
