package fr.juliette.thecode.transfer;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.HashMap;
import java.util.Map;

import fr.juliette.thecode.vault.Transfer;

/**
 * Accumule les QR codes lus jusqu'a reconstituer le payload.
 *
 * Les codes defilent en boucle sur l'ecran emetteur : on ne maitrise pas lequel
 * est vu quand. L'ordre ne compte donc pas, et un fragment lu deux fois est
 * simplement reecrit a l'identique.
 */
public final class FragmentCollector {

    private final Map<Integer, String> seen = new HashMap<>();
    private int total = 0;

    /** Codes deja lus, pour afficher l'avancement. */
    public int seenCount() {
        return seen.size();
    }

    public int expected() {
        return total;
    }

    /**
     * Accepte un code lu.
     *
     * @return le payload complet, ou {@code null} tant qu'il en manque — ou si
     *     le code ne vient pas de TheCode, auquel cas on ne dit rien : la
     *     camera vise peut-etre encore.
     */
    @Nullable
    public String accept(@NonNull String text) {
        if (text.startsWith("TC1.")) return text;
        if (!text.startsWith("TC1m.")) return null;

        String[] parts = text.split("\\.", 4);
        if (parts.length != 4) return null;

        int index;
        int count;
        try {
            index = Integer.parseInt(parts[1]);
            count = Integer.parseInt(parts[2]);
        } catch (NumberFormatException e) {
            return null;
        }
        if (count <= 0 || index < 0 || index >= count) return null;

        total = count;
        seen.put(index, parts[3]);
        return Transfer.assemble(seen, count);
    }

    public void reset() {
        seen.clear();
        total = 0;
    }
}
