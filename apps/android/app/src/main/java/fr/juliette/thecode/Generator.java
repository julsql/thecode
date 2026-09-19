package fr.juliette.thecode;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import fr.juliette.thecode.vault.SiteResolution;

/**
 * Applique la bonne version de l'algorithme à une résolution du carnet.
 *
 * Les deux versions coexistent, entrée par entrée : une entrée existante reste
 * en v1 et son mot de passe ne change pas, une entrée récente naît en v2. Sans
 * ce point de passage, chaque écran devrait s'en souvenir.
 *
 * Spécification : shared/spec/algo-v2.md
 */
public final class Generator {

    private Generator() {}

    /**
     * @param masterV2 clef maîtresse déjà dérivée, ou {@code null}. La
     *     dérivation v2 coûte volontairement cher : la réutiliser évite de la
     *     repayer à chaque suggestion.
     */
    public static String generate(@NonNull SiteResolution resolution, @NonNull String masterKey,
                                  @Nullable byte[] masterV2) {
        return generate(resolution, masterKey, masterV2, resolution.v);
    }

    /**
     * Comme ci-dessus, en imposant la version.
     *
     * Le remplissage automatique dérive toujours en v2 : il ne propose aucun
     * choix, il doit donc être prévisible. L'écran de génération, lui, offre
     * la v1 en secours pour un site pas encore migré.
     */
    public static String generate(@NonNull SiteResolution resolution, @NonNull String masterKey,
                                  @Nullable byte[] masterV2, int version) {
        Code code = new Code();
        code.setMinState(resolution.lower);
        code.setMajState(resolution.upper);
        code.setSymState(resolution.symbols);
        code.setChiState(resolution.numbers);
        code.setLength(resolution.length);

        if (version >= 2) {
            return CodeV2.getCode(code, masterKey, resolution.siteKey,
                    resolution.login, resolution.counter, masterV2);
        }
        // v1 : ni login ni compteur n'entrent dans la dérivation. C'est
        // précisément ce que la v2 corrige, mais le mot de passe d'une entrée
        // existante ne doit pas changer.
        return code.getCode(masterKey, resolution.siteKey);
    }
}
