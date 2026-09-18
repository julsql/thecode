package fr.juliette.thecode.autofill;

/**
 * Normalise un domaine (web ou nom de package) pour qu'une même entrée
 * produise toujours le même mot de passe — quelle que soit la source.
 *
 * Exemples :
 *   - https://login.google.com/foo  → google.com
 *   - www.facebook.com              → facebook.com
 *   - com.android.chrome            → chrome
 *   - app.example.fr                → example.fr (pour un package)
 */
final class DomainNormalizer {

    private DomainNormalizer() {}

    static String normalize(String value) {
        return normalize(value, false);
    }

    /**
     * Normalise une valeur en domaine canonique.
     *
     * Pour un package Android (reverse-DNS, ex. {@code com.instagram.android}),
     * on inverse les labels pour retrouver une forme {@code domaine.tld} —
     * {@code instagram.com} — qui colle au domaine web et permet de partager
     * le même mot de passe entre l'app et le navigateur.
     */
    static String normalize(String value, boolean isPackage) {
        if (value == null || value.isEmpty()) return "";

        String v = value.trim().toLowerCase();
        v = stripScheme(v);
        v = stripPath(v);
        v = stripPort(v);
        v = stripUserInfo(v);
        v = stripLeadingWww(v);

        if (!v.contains(".")) {
            return v;
        }
        if (isPackage) {
            v = reverseLabels(v);
        }
        return registrableDomain(v);
    }

    private static String reverseLabels(String host) {
        String[] parts = host.split("\\.");
        StringBuilder sb = new StringBuilder(host.length());
        for (int i = parts.length - 1; i >= 0; i--) {
            if (sb.length() > 0) sb.append('.');
            sb.append(parts[i]);
        }
        return sb.toString();
    }

    private static String stripScheme(String v) {
        int idx = v.indexOf("://");
        return idx >= 0 ? v.substring(idx + 3) : v;
    }

    private static String stripPath(String v) {
        int idx = v.indexOf('/');
        return idx >= 0 ? v.substring(0, idx) : v;
    }

    private static String stripPort(String v) {
        int idx = v.indexOf(':');
        return idx >= 0 ? v.substring(0, idx) : v;
    }

    private static String stripUserInfo(String v) {
        int idx = v.indexOf('@');
        return idx >= 0 ? v.substring(idx + 1) : v;
    }

    private static String stripLeadingWww(String v) {
        return v.startsWith("www.") ? v.substring(4) : v;
    }

    /**
     * Domaine enregistrable d'après la Public Suffix List.
     *
     * Remplace l'ancienne heuristique « deux derniers labels », qui rendait
     * {@code co.uk} pour {@code example.co.uk} et {@code github.io} pour
     * {@code foo.github.io} : deux mots de passe différents pour le même compte
     * selon qu'on était sur Android ou sur les autres plateformes.
     */
    private static String registrableDomain(String host) {
        return PublicSuffixList.registrableDomain(host);
    }
}
