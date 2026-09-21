package fr.juliette.thecode;

import android.graphics.Color;
import java.math.BigInteger;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;

/**
 * Classe responsable de la génération de mot de passe sécurisé
 * selon les options de l'utilisateur.
 */
public class Code {

    // Options pour la composition du mot de passe
    private boolean minState = true;
    private boolean majState = true;
    private boolean symState = true;
    private boolean chiState = true;

    // Longueur du mot de passe
    private int length = 2;

    // Sécurité et couleur
    private String safety;
    private int color;

    public Code() {
        safety = " Très Forte ";
        color = Color.parseColor("#1CD001");
    }

    public Code(int color) {
        this.color = color;
    }

    // --- Getters / Setters ---
    public boolean isMinState() { return minState; }
    public void setMinState(boolean minState) { this.minState = minState; }

    public boolean isMajState() { return majState; }
    public void setMajState(boolean majState) { this.majState = majState; }

    public boolean isSymState() { return symState; }
    public void setSymState(boolean symState) { this.symState = symState; }

    public boolean isChiState() { return chiState; }
    public void setChiState(boolean chiState) { this.chiState = chiState; }

    public int getLength() { return length; }
    public void setLength(int length) { this.length = length; }

    public String getSafety() { return safety; }
    public int getColor() { return color; }

    // --- Génération de base de caractères ---
    private List<String> getBase() {
        List<String> base = new ArrayList<>();
        if (minState) base.add("portezcviuxwhskyajgblndqfm");
        if (majState) base.add("THEQUICKBROWNFXJMPSVLAZYDG");
        if (symState) base.add("@#&!)-%;<:*$+=/?>(");
        if (chiState) base.add("567438921");
        return base;
    }

    // --- Calcul du nombre de bits de sécurité ---
    public int getBits() {
        int nbChar = String.join("", getBase()).length();
        return (int) Math.round(Math.log(Math.pow(nbChar, getBigLength())) / Math.log(2));
    }

    // --- Longueur effective du mot de passe ---
    public int getBigLength() {
        return length * length + 3 * length + 10;
    }

    // --- Mise à jour de la sécurité et couleur ---
    public void updateSafetyAndColor() {
        int bits = getBits();

        if (bits == 0) {
            safety = "Aucune";
            color = Color.parseColor("#FE0101");
        } else if (bits < 64) {
            safety = "Très Faible";
            color = Color.parseColor("#FE0101");
        } else if (bits < 80) {
            safety = "Faible";
            color = Color.parseColor("#FE4501");
        } else if (bits < 100) {
            safety = "Moyenne";
            color = Color.parseColor("#FE7601");
        } else if (bits < 126) {
            safety = "Forte";
            color = Color.parseColor("#53FE38");
        } else {
            safety = "Très Forte";
            color = Color.parseColor("#1CD001");
        }
    }

    // --- Génération du mot de passe ---
    public String getCode(String clef, String site) {
        BigInteger codeInt = new BigInteger(sha256(site + clef), 16);
        String baseStr = String.join("", getBase());
        String code = dec2Base(codeInt, baseStr).substring(0, getBigLength());
        return applyCharsetReplacement(codeInt, code, getBase());
    }

    // --- SHA256 en hexadécimal ---
    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes("UTF-8"));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    // --- Conversion BigInteger vers base personnalisée ---
    private String dec2Base(BigInteger x, String base) {
        BigInteger b = BigInteger.valueOf(base.length());
        StringBuilder result = new StringBuilder(String.valueOf(base.charAt(x.mod(b).intValue())));
        BigInteger one = BigInteger.ONE;
        x = x.divide(b).subtract(one);

        while (!x.add(BigInteger.valueOf(2)).equals(one)) {
            int idx = x.mod(b).intValue();
            result.insert(0, base.charAt(idx));
            x = x.divide(b).subtract(one);
        }
        return result.toString();
    }

    // --- Remplacement obligatoire pour inclure au moins un caractère de chaque groupe ---
    public static String applyCharsetReplacement(BigInteger seed, String password, List<String> charsetGroups) {
        if (password.length() < charsetGroups.size())
            throw new IllegalArgumentException("Password too short for charset groups");

        BigInteger temp = seed;
        List<Integer> positions = new ArrayList<>();
        int length = password.length();

        for (String group : charsetGroups) {
            int pos = getUniquePosition(temp, positions, length);
            positions.add(pos);
            temp = temp.divide(BigInteger.valueOf(length));
        }

        StringBuilder result = new StringBuilder(password);
        temp = seed;
        for (int i = 0; i < positions.size(); i++) {
            int pos = positions.get(i);
            String group = charsetGroups.get(i);
            int idx = temp.mod(BigInteger.valueOf(group.length())).intValue();
            result.setCharAt(pos, group.charAt(idx));
            temp = temp.divide(BigInteger.valueOf(group.length()));
        }

        return result.toString();
    }

    // --- Calcul d'une position unique ---
    public static int getUniquePosition(BigInteger seed, List<Integer> usedPositions, int length) {
        int pos = seed.mod(BigInteger.valueOf(length)).intValue();
        while (usedPositions.contains(pos)) {
            pos = (pos + 1) % length;
        }
        return pos;
    }

    public void setBits(int bits) {
        if (bits < 42) {
            length = 0;
            minState = false;
            majState = false;
            symState = false;
            chiState = true;
        } else if (bits < 47) {
            length = 0;
            minState = false;
            majState = false;
            symState = true;
            chiState = false;
        } else if (bits < 48) {
            length = 0;
            minState = true;
            majState = false;
            symState = false;
            chiState = false;
        } else if (bits < 51) {
            length = 0;
            minState = false;
            majState = false;
            symState = true;
            chiState = true;
        } else if (bits < 55) {
            length = 0;
            minState = true;
            majState = false;
            symState = false;
            chiState = true;
        } else if (bits < 57) {
            length = 0;
            minState = true;
            majState = false;
            symState = true;
            chiState = false;
        } else if (bits < 61) {
            length = 0;
            minState = true;
            majState = true;
            symState = false;
            chiState = false;
        } else if (bits < 63) {
            length = 0;
            minState = true;
            majState = true;
            symState = true;
            chiState = false;
        } else if (bits < 66) {
            length = 0;
            minState = true;
            majState = true;
            symState = true;
            chiState = true;
        } else if (bits < 67) {
            length = 1;
            minState = true;
            majState = false;
            symState = false;
            chiState = false;
        } else if (bits < 72) {
            length = 1;
            minState = false;
            majState = false;
            symState = true;
            chiState = true;
        } else if (bits < 76) {
            length = 1;
            minState = true;
            majState = false;
            symState = false;
            chiState = true;
        } else if (bits < 80) {
            length = 1;
            minState = true;
            majState = false;
            symState = true;
            chiState = false;
        } else if (bits < 86) {
            length = 1;
            minState = true;
            majState = true;
            symState = false;
            chiState = false;
        } else if (bits < 88) {
            length = 1;
            minState = true;
            majState = true;
            symState = true;
            chiState = false;
        } else if (bits < 94) {
            length = 1;
            minState = true;
            majState = true;
            symState = true;
            chiState = true;
        } else if (bits < 95) {
            length = 2;
            minState = true;
            majState = false;
            symState = false;
            chiState = false;
        } else if (bits < 103) {
            length = 2;
            minState = false;
            majState = false;
            symState = true;
            chiState = true;
        } else if (bits < 109) {
            length = 2;
            minState = true;
            majState = false;
            symState = false;
            chiState = true;
        } else if (bits < 114) {
            length = 2;
            minState = true;
            majState = false;
            symState = true;
            chiState = false;
        } else if (bits < 115) {
            length = 2;
            minState = true;
            majState = true;
            symState = false;
            chiState = false;
        } else if (bits < 123) {
            length = 2;
            minState = true;
            majState = false;
            symState = true;
            chiState = true;
        } else if (bits < 126) {
            length = 2;
            minState = true;
            majState = true;
            symState = true;
            chiState = false;
        } else {
            length = 2;
            minState = true;
            majState = true;
            symState = true;
            chiState = true;
        }
    }
}
