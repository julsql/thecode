package fr.juliette.thecode;

import androidx.annotation.NonNull;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.List;

import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Algorithme v2.
 *
 * La v1 hache {@code SHA-256(site + clef)}. Sans KDF, un seul mot de passe qui
 * fuite permet de retrouver la clef maîtresse hors ligne, et cette clef ouvre
 * tous les comptes. La v2 passe la clef dans PBKDF2 avant toute dérivation, et
 * sépare les champs par un octet nul — en v1, la simple concaténation faisait
 * collisionner ("google.com", "abc") et ("google.co", "mabc").
 *
 * Le rendu est identique à la v1 : c'est la partie qui a été mesurée saine.
 * Seule la graine change.
 *
 * Spécification : shared/spec/algo-v2.md
 */
public final class CodeV2 {

    private static final byte[] MASTER_SALT =
            "thecode-master/v2".getBytes(StandardCharsets.UTF_8);
    private static final int ITERATIONS = 600_000;
    private static final int KEY_BITS = 256;

    private static final byte[] PREFIX = "thecode/v2".getBytes(StandardCharsets.UTF_8);
    private static final byte SEPARATOR = 0x00;

    private CodeV2() {}

    /**
     * Passe la clef maîtresse dans un KDF coûteux.
     *
     * Le résultat se réutilise d'un site à l'autre : la dérivation coûte
     * volontairement cher, on ne la repaie pas à chaque mot de passe.
     */
    public static byte[] deriveMasterKey(@NonNull String masterKey)
            throws GeneralSecurityException {
        PBEKeySpec spec = new PBEKeySpec(masterKey.toCharArray(), MASTER_SALT, ITERATIONS, KEY_BITS);
        return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec)
                .getEncoded();
    }

    static BigInteger seed(@NonNull byte[] master, @NonNull String siteKey,
                           @NonNull String login, int counter) throws GeneralSecurityException {
        byte[] site = siteKey.getBytes(StandardCharsets.UTF_8);
        byte[] user = login.getBytes(StandardCharsets.UTF_8);
        byte[] count = String.valueOf(counter).getBytes(StandardCharsets.US_ASCII);

        byte[] message = new byte[PREFIX.length + 1 + site.length + 1 + user.length + 1
                + count.length];
        int at = 0;
        System.arraycopy(PREFIX, 0, message, at, PREFIX.length);
        at += PREFIX.length;
        message[at++] = SEPARATOR;
        System.arraycopy(site, 0, message, at, site.length);
        at += site.length;
        message[at++] = SEPARATOR;
        System.arraycopy(user, 0, message, at, user.length);
        at += user.length;
        message[at++] = SEPARATOR;
        System.arraycopy(count, 0, message, at, count.length);

        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(master, "HmacSHA256"));
        // 1 en signum : le condensat est un entier non signé, sans quoi un
        // premier octet ≥ 0x80 donnerait une graine négative et un rendu faux.
        return new BigInteger(1, mac.doFinal(message));
    }

    /**
     * Génère un mot de passe en v2.
     *
     * {@code master} évite de repayer le KDF quand on dérive plusieurs mots de
     * passe d'affilée. Passer {@code null} le dérive à la volée.
     */
    public static String getCode(@NonNull Code code, @NonNull String masterKey,
                                 @NonNull String siteKey, @NonNull String login, int counter,
                                 byte[] master) {
        List<String> groups = code.buildCharset();
        if (groups.isEmpty()) return "";
        if (code.getLength() < Code.MIN_LENGTH || code.getLength() > Code.MAX_LENGTH) return "";
        if (siteKey.isEmpty() && masterKey.isEmpty()) return "";

        try {
            BigInteger seed = seed(
                    master != null ? master : deriveMasterKey(masterKey),
                    siteKey, login, counter);

            StringBuilder fullBase = new StringBuilder();
            for (String g : groups) fullBase.append(g);

            String raw = Code.convertToBase(seed, fullBase.toString());
            if (raw.length() > code.getLength()) raw = raw.substring(0, code.getLength());

            return Code.applyCharsetReplacement(seed, raw, groups);
        } catch (GeneralSecurityException e) {
            // PBKDF2WithHmacSHA256 et HmacSHA256 sont garantis par la
            // plateforme : une absence signalerait un appareil hors spec.
            return "";
        }
    }
}
