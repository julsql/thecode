package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.List;

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
     * Même règle, pour le remplissage : proposer quand ce qui est rempli ne
     * vient d'aucune entrée du carnet — site inconnu, ou identifiant saisi qui
     * désigne un nouveau compte sur un site connu.
     */
    public static boolean shouldPropose(boolean syncLinked,
                                        @NonNull List<SiteResolution> resolutions) {
        if (!syncLinked || resolutions.isEmpty()) return false;
        for (SiteResolution r : resolutions) {
            if (!r.entryId.isEmpty()) return false;
        }
        return true;
    }

    /**
     * L'identifiant à enregistrer pour un mot de passe soumis, ou {@code null}
     * s'il ne faut rien enregistrer.
     *
     * Le carnet ne stocke pas de mot de passe : il le recalcule. Un mot de passe
     * que TheCode ne redonne pas (tapé à la main, venu d'ailleurs) produirait
     * une entrée qui en proposerait ensuite un autre : on ne l'enregistre pas,
     * comme sur iOS.
     *
     * L'identifiant entre dans la dérivation v2 : on garde celui qui redonne le
     * mot de passe soumis — le remplissage dérive désormais avec l'identifiant
     * saisi, il le redonne donc directement — puis l'identifiant vide, qui est
     * ce qu'utilise le remplissage quand rien n'était saisi.
     */
    @Nullable
    public static String loginToStore(@Nullable String submittedPassword,
                                      @Nullable String username, @NonNull Deriver deriver) {
        if (submittedPassword == null || submittedPassword.isEmpty()) return null;
        String user = username == null ? "" : username.trim();
        if (!user.isEmpty() && submittedPassword.equals(deriver.passwordFor(user))) return user;
        if (submittedPassword.equals(deriver.passwordFor(""))) return "";
        return null;
    }
}
