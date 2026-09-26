package fr.juliette.thecode;

/**
 * Robustesse de la clef maîtresse.
 *
 * <p>Toute la sécurité du carnet synchronisé repose sur cette clef : un attaquant
 * qui obtient la base peut essayer hors ligne les clefs courantes. Ce calcul ne
 * sert qu'à guider, il ne bloque jamais la définition de la clef. Purement
 * local : ni réseau, ni journal, ni stockage.
 *
 * <p>Spécification : shared/spec/key-strength.md
 */
public final class KeyStrength {

    public enum Level { NONE, WEAK, FAIR, STRONG }

    static final int WEAK_BELOW = 10;
    static final int STRONG_FROM = 16;
    static final int STRONG_WORDS = 4;

    private KeyStrength() {}

    public static Level of(String key) {
        if (key == null || key.isEmpty()) return Level.NONE;
        // Points de code, pas unités UTF-16 : un emoji compte pour un caractère.
        int length = key.codePointCount(0, key.length());
        if (length < WEAK_BELOW) return Level.WEAK;
        if (length >= STRONG_FROM || words(key) >= STRONG_WORDS) return Level.STRONG;
        return classes(key) >= 2 ? Level.FAIR : Level.WEAK;
    }

    private static boolean isBlank(int c) {
        return c == ' ' || c == '\t' || c == '\n' || c == '\r';
    }

    private static int words(String key) {
        int count = 0;
        boolean inWord = false;
        for (int i = 0; i < key.length(); i++) {
            boolean blank = isBlank(key.charAt(i));
            if (!blank && !inWord) count++;
            inWord = !blank;
        }
        return count;
    }

    private static int classes(String key) {
        boolean lower = false;
        boolean upper = false;
        boolean digit = false;
        boolean other = false;
        for (int i = 0; i < key.length(); ) {
            int c = key.codePointAt(i);
            i += Character.charCount(c);
            if (c >= 'a' && c <= 'z') lower = true;
            else if (c >= 'A' && c <= 'Z') upper = true;
            else if (c >= '0' && c <= '9') digit = true;
            else other = true;
        }
        return (lower ? 1 : 0) + (upper ? 1 : 0) + (digit ? 1 : 0) + (other ? 1 : 0);
    }
}
