package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Chiffrement du carnet avant qu'il ne quitte l'appareil.
 *
 * Le serveur ne reçoit que des blocs opaques : il ne peut lire ni les sites, ni
 * les identifiants.
 *
 * Le sel diffère de celui des mots de passe et de celui de l'empreinte : une
 * même valeur dérivée ne doit jamais servir à deux usages, sinon une faiblesse
 * sur l'un exposerait l'autre.
 *
 * Spécification : shared/spec/vault-transfer.md
 */
public final class Transfer {

    private static final byte[] SALT = "thecode-transfer/v1".getBytes(StandardCharsets.UTF_8);
    private static final int ITERATIONS = 600_000;
    private static final int KEY_BITS = 256;
    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;

    private static final SecureRandom RANDOM = new SecureRandom();

    private Transfer() {}

    /** Dérive la clef de transfert depuis la clef maîtresse. */
    public static SecretKey deriveKey(@NonNull String masterKey) throws GeneralSecurityException {
        PBEKeySpec spec = new PBEKeySpec(masterKey.toCharArray(), SALT, ITERATIONS, KEY_BITS);
        byte[] raw = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                .generateSecret(spec).getEncoded();
        return new SecretKeySpec(raw, "AES");
    }

    /** Un bloc chiffré : nonce et données, tous deux opaques pour le serveur. */
    public static final class Sealed {
        public final byte[] nonce;
        public final byte[] blob;

        Sealed(byte[] nonce, byte[] blob) {
            this.nonce = nonce;
            this.blob = blob;
        }
    }

    public static Sealed seal(@NonNull SecretKey key, @NonNull String plain)
            throws GeneralSecurityException {
        // Un nonce jamais réutilisé avec la même clef : le contraire casse
        // AES-GCM.
        byte[] nonce = new byte[NONCE_BYTES];
        RANDOM.nextBytes(nonce);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, nonce));
        return new Sealed(nonce, cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8)));
    }

    /**
     * Déchiffre en octets.
     *
     * Le contenu d'un transfert est compressé, donc binaire : passer par une
     * String UTF-8 corromprait les octets qui ne forment pas du texte valide.
     */
    public static byte[] openBytes(@NonNull SecretKey key, @NonNull byte[] nonce,
                                   @NonNull byte[] blob) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, nonce));
        return cipher.doFinal(blob);
    }

    /** Déchiffre du texte. Pour du binaire, voir {@link #openBytes}. */
    public static String open(@NonNull SecretKey key, @NonNull byte[] nonce, @NonNull byte[] blob)
            throws GeneralSecurityException {
        return new String(openBytes(key, nonce, blob), StandardCharsets.UTF_8);
    }
}
