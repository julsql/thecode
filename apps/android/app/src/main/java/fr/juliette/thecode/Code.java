package fr.juliette.thecode;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;

/**
 * Génération déterministe d'un mot de passe à partir d'une clé et d'un nom de site.
 * Algorithme strictement aligné sur l'application Apple (PasswordUtils.swift).
 */
public class Code {

    private static final String LOWER = "portezcviuxwhskyajgblndqfm";
    private static final String UPPER = "THEQUICKBROWNFXJMPSVLAZYDG";
    private static final String SYMBOLS = "@#&!)-%;<:*$+=/?>(";
    private static final String DIGITS = "567438921";

    /**
     * Couleurs des niveaux de sécurité, en ARGB littéral. Volontairement pas de
     * parsing via android.graphics.Color : cette classe reste ainsi du Java
     * pur, testable en JVM sans mock (c'est ce qui faisait échouer
     * CodeUnitTest, dont 10 cas sur 12 plantaient au chargement).
     */
    private static final int COLOR_NONE        = 0xFFFE0101;
    private static final int COLOR_VERY_WEAK   = 0xFFFE0101;
    private static final int COLOR_WEAK        = 0xFFFE4501;
    private static final int COLOR_MEDIUM      = 0xFFFE7601;
    private static final int COLOR_STRONG      = 0xFF53FE38;
    private static final int COLOR_VERY_STRONG = 0xFF1CD001;

    public static final int MIN_LENGTH = 4;
    public static final int MAX_LENGTH = 40;
    public static final int DEFAULT_LENGTH = 20;

    /**
     * Niveaux de sécurité indépendants de la langue. La traduction du libellé
     * est faite côté UI (via les ressources string), et la couleur côté UI ou
     * directement ici via {@link #getColor()} pour le code historique.
     */
    public enum SafetyLevel { NONE, VERY_WEAK, WEAK, MEDIUM, STRONG, VERY_STRONG }

    private boolean minState = true;
    private boolean majState = true;
    private boolean symState = true;
    private boolean chiState = true;

    private int length = DEFAULT_LENGTH;

    private SafetyLevel safetyLevel = SafetyLevel.VERY_STRONG;
    private int color = COLOR_VERY_STRONG;

    public Code() {}

    public Code(int color) {
        this.color = color;
    }

    public boolean isMinState() { return minState; }
    public void setMinState(boolean v) { this.minState = v; }

    public boolean isMajState() { return majState; }
    public void setMajState(boolean v) { this.majState = v; }

    public boolean isSymState() { return symState; }
    public void setSymState(boolean v) { this.symState = v; }

    public boolean isChiState() { return chiState; }
    public void setChiState(boolean v) { this.chiState = v; }

    public int getLength() { return length; }
    public void setLength(int length) { this.length = length; }

    public SafetyLevel getSafetyLevel() { return safetyLevel; }
    public int getColor() { return color; }

    /**
     * Construit la liste des sous-alphabets actifs selon les options choisies.
     */
    public List<String> buildCharset() {
        List<String> base = new ArrayList<>();
        if (minState) base.add(LOWER);
        if (majState) base.add(UPPER);
        if (symState) base.add(SYMBOLS);
        if (chiState) base.add(DIGITS);
        return base;
    }

    /**
     * Entropie en bits pour les options et la longueur courantes.
     */
    public int getBits() {
        int total = 0;
        for (String s : buildCharset()) total += s.length();
        if (total == 0) return 0;
        return (int) (length * (Math.log(total) / Math.log(2)));
    }

    /**
     * Met à jour le label et la couleur de sécurité en fonction de l'entropie.
     */
    public void updateSafetyAndColor() {
        int bits = getBits();
        if (bits == 0) {
            safetyLevel = SafetyLevel.NONE;
            color = COLOR_NONE;
        } else if (bits < 64) {
            safetyLevel = SafetyLevel.VERY_WEAK;
            color = COLOR_VERY_WEAK;
        } else if (bits < 80) {
            safetyLevel = SafetyLevel.WEAK;
            color = COLOR_WEAK;
        } else if (bits < 100) {
            safetyLevel = SafetyLevel.MEDIUM;
            color = COLOR_MEDIUM;
        } else if (bits < 126) {
            safetyLevel = SafetyLevel.STRONG;
            color = COLOR_STRONG;
        } else {
            safetyLevel = SafetyLevel.VERY_STRONG;
            color = COLOR_VERY_STRONG;
        }
    }

    /**
     * Génère le mot de passe pour la clé et le site donnés.
     * Retourne une chaîne vide si aucune option de caractères n'est activée.
     */
    public String getCode(String clef, String site) {
        List<String> groups = buildCharset();
        if (groups.isEmpty()) return "";
        if (length < MIN_LENGTH || length > MAX_LENGTH) return "";

        BigInteger seed = sha256ToBigInteger(site + clef);

        StringBuilder fullBase = new StringBuilder();
        for (String g : groups) fullBase.append(g);

        String raw = convertToBase(seed, fullBase.toString());
        if (raw.length() > length) raw = raw.substring(0, length);

        return applyCharsetReplacement(seed, raw, groups);
    }

    private static BigInteger sha256ToBigInteger(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                String h = Integer.toHexString(0xff & b);
                if (h.length() == 1) hex.append('0');
                hex.append(h);
            }
            return new BigInteger(hex.toString(), 16);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    /**
     * Convertit un BigInteger dans une base personnalisée formée par les caractères donnés.
     */
    static String convertToBase(BigInteger seed, String charset) {
        BigInteger base = BigInteger.valueOf(charset.length());
        BigInteger value = seed;
        StringBuilder result = new StringBuilder();
        BigInteger one = BigInteger.ONE;

        while (value.signum() >= 0) {
            int idx = value.mod(base).intValue();
            result.insert(0, charset.charAt(idx));
            value = value.divide(base).subtract(one);
            if (value.signum() < 0) break;
        }
        return result.toString();
    }

    /**
     * Garantit la présence d'au moins un caractère de chaque sous-alphabet
     * actif en remplaçant des positions déterministes du mot de passe.
     */
    public static String applyCharsetReplacement(BigInteger seed, String password, List<String> charsetGroups) {
        int len = password.length();
        if (len < charsetGroups.size()) {
            throw new IllegalArgumentException("Password too short for charset groups");
        }

        BigInteger temp = seed;
        List<Integer> positions = new ArrayList<>(charsetGroups.size());
        for (int i = 0; i < charsetGroups.size(); i++) {
            int pos = uniquePosition(temp, positions, len);
            positions.add(pos);
            temp = temp.divide(BigInteger.valueOf(len));
        }

        StringBuilder result = new StringBuilder(password);
        temp = seed;
        for (int i = 0; i < positions.size(); i++) {
            String group = charsetGroups.get(i);
            BigInteger gLen = BigInteger.valueOf(group.length());
            int idx = temp.mod(gLen).intValue();
            result.setCharAt(positions.get(i), group.charAt(idx));
            temp = temp.divide(gLen);
        }
        return result.toString();
    }

    static int uniquePosition(BigInteger seed, List<Integer> used, int length) {
        int pos = seed.mod(BigInteger.valueOf(length)).intValue();
        while (used.contains(pos)) {
            pos = (pos + 1) % length;
        }
        return pos;
    }
}
