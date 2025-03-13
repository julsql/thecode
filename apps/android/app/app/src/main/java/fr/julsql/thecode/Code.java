package fr.julsql.thecode;

import android.graphics.Color;

import java.math.BigInteger;
import java.security.MessageDigest;

public class Code {
    private boolean minState;
    private boolean majState;
    private boolean symState;
    private boolean chiState;
    private int length;
    private String safety;
    private int color;

    public Code() {
        minState = true;
        majState = true;
        symState = true;
        chiState = true;
        length = 2;
        safety = " Très Forte ";
        color = Color.parseColor("#1CD001");
    }

    public Code(int color) {
        minState = true;
        majState = true;
        symState = true;
        chiState = true;
        length = 2;
        safety = " Très Forte ";
        this.color = color;
    }

    public boolean isMinState() {
        return minState;
    }

    public void setMinState(boolean minState) {
        this.minState = minState;
    }

    public boolean isMajState() {
        return majState;
    }

    public void setMajState(boolean majState) {
        this.majState = majState;
    }

    public boolean isSymState() {
        return symState;
    }

    public void setSymState(boolean symState) {
        this.symState = symState;
    }

    public boolean isChiState() {
        return chiState;
    }

    public void setChiState(boolean chiState) {
        this.chiState = chiState;
    }

    public String getSafety() {
        return safety;
    }

    public void setSafety() {
        int bits = getBits();
        if (bits == 0) {
            safety = " Aucune ";
        } else if (bits < 64) {
            safety = " Très Faible ";
        } else if (bits < 80) {
            safety = " Faible ";
        } else if (bits < 100) {
            safety = " Moyenne ";
        } else if (bits < 126) {
            safety = " Forte ";
        } else {
            safety = " Très Forte ";
        }
    }

    public int getBigLength() {
        return length * length + 3 * length + 10;
    }

    public int getLength() {
        return length;
    }

    public void setLength(int length) {
        this.length = length;
    }


    public int getColor() {
        // Renvoie la bonne couleur ainsi que la sécurité suivant le nombre de bits
        return color;
    }

    public void setColor() {
        int bits = getBits();
        String color;
        if (bits == 0) {
            color = "#FE0101";
        } else if (bits < 64) {
            color = "#FE0101";
        } else if (bits < 80) {
            color = "#FE4501";
        } else if (bits < 100) {
            color = "#FE7601";
        } else if (bits < 126) {
            color = "#53FE38";
        } else {
            color = "#1CD001";
        }
        this.color = Color.parseColor(color);
    }

    public String getBase() {
        // Modifie la base suivant les caractères cochés

        String base = "";
        if (minState) {
            base += "portezcviuxwhskyajgblndqfm";
        }
        if (majState) {
            base += "THEQUICKBROWNFXJMPSVLAZYDG";
        }
        if (symState) {
            base += "@#&!)-%;<:*$+=/?>(";
        }
        if (chiState) {
            base += "567438921";
        }
        return base;
    }

    public String getCode(String clef, String site) {
        BigInteger code = new BigInteger(sha256(site + clef), 16);
        return dec2Base(code, getBase()).substring(0, getBigLength());
    }

    public int getBits() {
        int nbChar = getBase().length();
        return (int) ((Math.round(Math.log(Math.pow(nbChar, getBigLength())) / Math.log(2))));
    }



    private String dec2Base(BigInteger x, String base) {
        // Convertit un BigInteger dans une base ayant base comme support

        BigInteger b = new BigInteger(String.valueOf(base.length()));
        StringBuilder result = new StringBuilder(base.charAt(x.mod(b).intValue()));
        BigInteger un = new BigInteger("1");
        BigInteger deux = new BigInteger("2");
        x = (x.divide(b)).subtract(un);

        while (! (x.add(deux)).equals(un)) {
            int inter = x.mod(b).intValue();
            result.insert(0, base.charAt(inter));
            x = (x.divide(b)).subtract(un);
        }

        return result.toString();
    }

    private static String sha256(String code) {
        // Modifie mot en un chiffre en hexadécimal suivant la fonction de hachage sha256

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(code.getBytes("UTF-8"));
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