package fr.juliette.thecode;

import androidx.annotation.NonNull;

import java.nio.charset.StandardCharsets;
import java.security.NoSuchAlgorithmException;
import java.security.spec.InvalidKeySpecException;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/**
 * Empreinte de la clef maîtresse.
 *
 * Une faute de frappe sur la clef ne se voit pas : elle produit simplement un
 * autre mot de passe, valide en apparence. On ne s'en aperçoit qu'au refus de
 * connexion, sans savoir si le tort vient de la clef, du site ou des réglages.
 *
 * Spécification : shared/spec/fingerprint.md
 */
public final class Fingerprint {

    private static final byte[] SALT = "thecode-fingerprint/v1".getBytes(StandardCharsets.UTF_8);
    private static final int ITERATIONS = 600_000;
    private static final int KEY_BITS = 256;

    /**
     * Sans 0/O ni 1/I/L : une empreinte se lit parfois à voix haute, elle ne
     * doit laisser aucune hésitation.
     */
    private static final String ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    private static final int LENGTH = 3;

    /** Douze teintes distinctes, pour un repère visuel immédiat. */
    private static final int[] COLORS = {
            0xFFE5484D, 0xFFF76B15, 0xFFFFB224, 0xFFBDEE63,
            0xFF46A758, 0xFF29A383, 0xFF00A2C7, 0xFF0090FF,
            0xFF3E63DD, 0xFF6E56CF, 0xFFD6409F, 0xFFE93D82,
    };

    private Fingerprint() {}

    /** Résultat : trois caractères et une couleur. */
    public static final class Result {
        public final String text;
        public final int color;

        Result(String text, int color) {
            this.text = text;
            this.color = color;
        }
    }

    private static byte[] derive(String masterKey) {
        try {
            PBEKeySpec spec = new PBEKeySpec(
                    masterKey.toCharArray(), SALT, ITERATIONS, KEY_BITS);
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(spec).getEncoded();
        } catch (NoSuchAlgorithmException | InvalidKeySpecException e) {
            // Algorithme absent : plutôt que d'afficher une empreinte fausse,
            // on n'en affiche aucune. Un repère erroné serait pire que pas de
            // repère du tout.
            return null;
        }
    }

    /** Empreinte de la clef, ou {@code null} si elle ne peut pas être calculée. */
    public static Result of(@NonNull String masterKey) {
        if (masterKey.isEmpty()) return null;

        byte[] raw = derive(masterKey);
        if (raw == null) return null;

        StringBuilder text = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            text.append(ALPHABET.charAt((raw[i] & 0xFF) % ALPHABET.length()));
        }
        return new Result(text.toString(), COLORS[(raw[LENGTH] & 0xFF) % COLORS.length]);
    }
}
