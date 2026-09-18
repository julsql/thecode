package fr.juliette.thecode.autofill;

import android.content.Context;
import android.util.Log;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * Public Suffix List embarquée, utilisée pour déterminer le domaine
 * enregistrable d'un hôte.
 *
 * Android utilisait auparavant une heuristique « deux derniers labels », sans
 * PSL. Elle produisait {@code co.uk} pour {@code example.co.uk} et
 * {@code github.io} pour {@code foo.github.io}, là où l'extension et les apps
 * Apple rendaient le domaine complet : deux mots de passe différents pour le
 * même compte selon l'appareil.
 *
 * Comme sur Apple, l'absence de liste n'est pas compensée en silence : sans
 * elle, on refuse de canonicaliser plutôt que de produire un mot de passe qui
 * divergerait des autres plateformes.
 */
public final class PublicSuffixList {

    private static final String TAG = "TheCode";
    private static final String ASSET = "public_suffix_list.dat";

    private static volatile Set<String> suffixes = Collections.emptySet();

    private PublicSuffixList() {}

    /** Charge la liste depuis les assets. Idempotent. */
    public static void load(Context context) {
        if (!suffixes.isEmpty()) return;
        try (InputStream in = context.getApplicationContext().getAssets().open(ASSET)) {
            suffixes = Collections.unmodifiableSet(parse(in));
            Log.i(TAG, "Public Suffix List chargée (" + suffixes.size() + " entrées)");
        } catch (IOException e) {
            Log.e(TAG, "Public Suffix List absente des assets : la canonicalisation "
                    + "est désactivée pour ne pas produire de mots de passe divergents", e);
        }
    }

    /** Injection directe, pour les tests unitaires qui n'ont pas de Context. */
    static void loadForTests(Set<String> entries) {
        suffixes = Collections.unmodifiableSet(new HashSet<>(entries));
    }

    static void resetForTests() {
        suffixes = Collections.emptySet();
    }

    public static boolean isLoaded() {
        return !suffixes.isEmpty();
    }

    private static Set<String> parse(InputStream in) throws IOException {
        Set<String> out = new HashSet<>(16000);
        try (BufferedReader reader =
                     new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (!trimmed.isEmpty() && !trimmed.startsWith("//")) {
                    out.add(trimmed);
                }
            }
        }
        return out;
    }

    /**
     * Domaine enregistrable d'après la PSL, équivalent strict de
     * {@code registrableDomain} côté JavaScript et Swift.
     *
     * @return le domaine enregistrable, ou une chaîne vide si la liste n'est
     *         pas chargée — auquel cas rien ne doit être proposé.
     */
    static String registrableDomain(String hostname) {
        if (!isLoaded()) return "";

        String lower = hostname.toLowerCase();
        String[] parts = lower.split("\\.");

        for (int i = 0; i < parts.length; i++) {
            StringBuilder candidate = new StringBuilder();
            for (int j = i; j < parts.length; j++) {
                if (j > i) candidate.append('.');
                candidate.append(parts[j]);
            }
            if (suffixes.contains(candidate.toString())) {
                // i == 0 : l'hôte EST un suffixe public (github.io, co.uk). On
                // ne peut pas remonter d'un cran, on le rend tel quel.
                if (i == 0) return lower;
                StringBuilder out = new StringBuilder();
                for (int j = i - 1; j < parts.length; j++) {
                    if (j > i - 1) out.append('.');
                    out.append(parts[j]);
                }
                return out.toString();
            }
        }
        return lower;
    }
}
