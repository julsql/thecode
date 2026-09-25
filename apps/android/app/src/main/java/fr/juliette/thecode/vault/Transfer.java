package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONException;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.zip.Deflater;
import java.util.zip.Inflater;
import java.util.zip.DataFormatException;

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

    public static final String PREFIX = "TC1";

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

    // --------------------------------------- decoupage en plusieurs QR

    /**
     * Un QR plafonne a ~2,9 Ko. On garde de la marge pour l'en-tete du
     * fragment, qui s'ajoute a chaque morceau.
     */
    public static final int FRAGMENT_LIMIT = 2600;

    /**
     * Decoupe un payload en fragments affichables l'un apres l'autre.
     *
     * Un seul fragment quand le payload tient : inutile d'imposer un
     * assemblage pour un carnet ordinaire.
     */
    public static List<String> fragments(@NonNull String payload) {
        List<String> out = new ArrayList<>();
        if (payload.length() <= FRAGMENT_LIMIT) {
            out.add(payload);
            return out;
        }

        // Le prefixe « TC1. » est porte une fois par le reassemblage, pas par
        // chaque fragment.
        String body = payload.substring(PREFIX.length() + 1);
        int total = (body.length() + FRAGMENT_LIMIT - 1) / FRAGMENT_LIMIT;
        for (int i = 0; i < total; i++) {
            int from = i * FRAGMENT_LIMIT;
            int to = Math.min(from + FRAGMENT_LIMIT, body.length());
            out.add("TC1m." + i + "." + total + "." + body.substring(from, to));
        }
        return out;
    }

    /**
     * Assemble les fragments lus. Rend null tant qu'il en manque.
     *
     * L'ordre n'a pas d'importance et un fragment lu deux fois est ignore :
     * les codes defilent en boucle, on ne maitrise pas ce qui est vu quand.
     */
    @Nullable
    public static String assemble(@NonNull Map<Integer, String> fragments, int total) {
        if (total <= 0 || fragments.size() != total) return null;

        StringBuilder body = new StringBuilder();
        for (int i = 0; i < total; i++) {
            String part = fragments.get(i);
            if (part == null) return null;
            body.append(part);
        }
        return PREFIX + "." + body;
    }

    // ------------------------------------------------- carnet entier

    /** Payload illisible : version inconnue, format casse, ou mauvaise clef. */
    public static class TransferException extends Exception {
        public TransferException(String message) {
            super(message);
        }
    }

    /** Deflate brut, pour qu'un carnet de cinquante entrees tienne dans un QR. */
    static byte[] deflate(byte[] raw) {
        Deflater deflater = new Deflater(Deflater.BEST_COMPRESSION);
        deflater.setInput(raw);
        deflater.finish();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        while (!deflater.finished()) {
            out.write(chunk, 0, deflater.deflate(chunk));
        }
        deflater.end();
        return out.toByteArray();
    }

    static byte[] inflate(byte[] raw) throws TransferException {
        Inflater inflater = new Inflater();
        inflater.setInput(raw);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        try {
            while (!inflater.finished()) {
                int n = inflater.inflate(chunk);
                if (n == 0 && (inflater.needsInput() || inflater.needsDictionary())) break;
                out.write(chunk, 0, n);
            }
        } catch (DataFormatException e) {
            throw new TransferException("Contenu illisible apres dechiffrement.");
        } finally {
            inflater.end();
        }
        return out.toByteArray();
    }

    /** Chiffre un carnet en un payload transportable. */
    public static String exportVault(@NonNull Vault vault, @NonNull String masterKey)
            throws GeneralSecurityException, JSONException {
        return exportJson(vault.toCompactJson(), masterKey);
    }

    /** Chiffre un carnet déjà sérialisé. Séparé pour les tests d'interopérabilité. */
    static String exportJson(@NonNull String json, @NonNull String masterKey)
            throws GeneralSecurityException {
        byte[] compressed = deflate(json.getBytes(StandardCharsets.UTF_8));

        byte[] nonce = new byte[NONCE_BYTES];
        RANDOM.nextBytes(nonce);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, deriveKey(masterKey),
                new GCMParameterSpec(TAG_BITS, nonce));

        return PREFIX + "." + Base64Url.encode(nonce) + "."
                + Base64Url.encode(cipher.doFinal(compressed));
    }

    /** Dechiffre un payload. Leve TransferException s'il est illisible. */
    public static Vault importVault(@NonNull String payload, @NonNull String masterKey)
            throws TransferException {
        String[] parts = payload.trim().split("\\.");
        if (parts.length != 3) {
            throw new TransferException("Format inattendu : TC1.<nonce>.<donnees> attendu.");
        }
        if (!PREFIX.equals(parts[0])) {
            // Interpreter un format inconnu au hasard serait pire que refuser.
            throw new TransferException(
                    "Version « " + parts[0] + " » inconnue, ce client lit " + PREFIX + ".");
        }

        byte[] plain;
        try {
            plain = openBytes(deriveKey(masterKey),
                    Base64Url.decode(parts[1]), Base64Url.decode(parts[2]));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new TransferException(
                    "Dechiffrement impossible : clef maitresse differente, ou donnees alterees.");
        }

        try {
            return Vault.fromJson(new String(inflate(plain), StandardCharsets.UTF_8));
        } catch (JSONException e) {
            throw new TransferException("Carnet illisible : " + e.getMessage());
        }
    }
}
