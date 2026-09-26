package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONException;
import org.json.JSONObject;

import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/**
 * Mot de passe de carnet : jamais conservé, seulement son empreinte.
 *
 * Voir shared/spec/vault-lock.md : PBKDF2-SHA256, 600 000 itérations, sel de
 * 16 octets, 32 octets dérivés, stocké sous la forme {@code {v, salt, hash}}.
 * Coûteux à dessein : jamais sur le fil de l'interface.
 */
public final class VaultPassword {

    public static final int VERSION = 1;
    public static final int ITERATIONS = 600_000;
    public static final int SALT_BYTES = 16;
    public static final int HASH_BYTES = 32;
    public static final int MIN_LENGTH = 8;

    /** Résultat de la validation d'un nouveau mot de passe saisi deux fois. */
    public enum Check { OK, TOO_SHORT, MISMATCH }

    private static final SecureRandom RANDOM = new SecureRandom();

    private VaultPassword() {}

    @NonNull
    public static Check checkNew(@NonNull String password, @NonNull String confirmation) {
        if (password.length() < MIN_LENGTH) return Check.TOO_SHORT;
        if (!password.equals(confirmation)) return Check.MISMATCH;
        return Check.OK;
    }

    /** Empreinte d'un nouveau mot de passe, prête à stocker. */
    @NonNull
    public static String hash(@NonNull char[] password) {
        byte[] salt = new byte[SALT_BYTES];
        RANDOM.nextBytes(salt);
        return record(salt, derive(password, salt, ITERATIONS));
    }

    /**
     * Vrai si le mot de passe correspond à l'empreinte stockée. Un
     * enregistrement illisible ou d'une version inconnue ne vérifie rien.
     */
    public static boolean verify(@NonNull char[] password, @Nullable String stored) {
        if (stored == null || stored.isEmpty()) return false;
        try {
            JSONObject o = new JSONObject(stored);
            if (o.optInt("v", -1) != VERSION) return false;
            byte[] salt = Base64Url.decode(o.getString("salt"));
            byte[] expected = Base64Url.decode(o.getString("hash"));
            if (salt.length != SALT_BYTES || expected.length != HASH_BYTES) return false;
            byte[] actual = derive(password, salt, ITERATIONS);
            // Temps constant : ne rien laisser deviner par la durée.
            return MessageDigest.isEqual(expected, actual);
        } catch (JSONException | IllegalArgumentException e) {
            return false;
        }
    }

    @NonNull
    static String record(@NonNull byte[] salt, @NonNull byte[] hash) {
        try {
            return new JSONObject()
                    .put("v", VERSION)
                    .put("salt", Base64Url.encode(salt))
                    .put("hash", Base64Url.encode(hash))
                    .toString();
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }

    @NonNull
    static byte[] derive(@NonNull char[] password, @NonNull byte[] salt, int iterations) {
        PBEKeySpec spec = new PBEKeySpec(password, salt, iterations, HASH_BYTES * 8);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(spec).getEncoded();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("PBKDF2-SHA256 indisponible", e);
        } finally {
            spec.clearPassword();
        }
    }

    /** Efface une saisie une fois utilisée. */
    public static void wipe(@Nullable char[] password) {
        if (password != null) Arrays.fill(password, '\0');
    }
}
