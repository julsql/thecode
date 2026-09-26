package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONException;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
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
 * Chaque usage dérive sa clef avec son propre sel, préfixé d'une étiquette
 * versionnée, et chiffre avec ses propres données associées : une même valeur
 * dérivée ne sert jamais à deux usages, et un bloc chiffré pour l'un ne se lit
 * pas comme l'autre.
 *
 * Spécifications : shared/spec/vault-transfer.md et shared/spec/vault-sync.md
 */
public final class Transfer {

    public static final String PREFIX = "TC2";
    /** En-tête des fragments quand le payload est découpé en plusieurs QR codes. */
    public static final String MULTIPART_PREFIX = "TC2m";

    static final byte[] TRANSFER_KDF_LABEL = utf8("thecode-transfer/v2");
    static final byte[] SYNC_KDF_LABEL = utf8("thecode-sync/v2");
    /** Données associées AES-GCM d'un transfert. */
    public static final byte[] TRANSFER_AAD = utf8("thecode/transfer/v2");
    /** Données associées AES-GCM des réglages par défaut. */
    public static final byte[] SETTINGS_AAD = utf8("thecode/settings/v2");
    /** Préfixe des données associées d'une entrée, suivi de son identifiant. */
    static final String ENTRY_AAD_PREFIX = "thecode/entry/v2|";

    public static final int SALT_BYTES = 16;
    private static final int ITERATIONS = 600_000;
    private static final int KEY_BITS = 256;
    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;

    private static final SecureRandom RANDOM = new SecureRandom();

    private Transfer() {}

    private static byte[] utf8(String value) {
        return value.getBytes(StandardCharsets.UTF_8);
    }

    private static byte[] concat(byte[] a, byte[] b) {
        byte[] out = Arrays.copyOf(a, a.length + b.length);
        System.arraycopy(b, 0, out, a.length, b.length);
        return out;
    }

    /** PBKDF2-HMAC-SHA256, 600 000 itérations, 32 octets. */
    static SecretKey pbkdf2(@NonNull String masterKey, @NonNull byte[] salt)
            throws GeneralSecurityException {
        PBEKeySpec spec = new PBEKeySpec(masterKey.toCharArray(), salt, ITERATIONS, KEY_BITS);
        try {
            byte[] raw = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(spec).getEncoded();
            return new SecretKeySpec(raw, "AES");
        } finally {
            spec.clearPassword();
        }
    }

    /** Clef d'un transfert, à partir du sel aléatoire de son payload. */
    public static SecretKey deriveTransferKey(@NonNull String masterKey, @NonNull byte[] salt)
            throws GeneralSecurityException {
        return pbkdf2(masterKey, concat(TRANSFER_KDF_LABEL, salt));
    }

    /**
     * Clef de synchronisation : propre à la clef maîtresse <b>et</b> au compte.
     *
     * Le sel du compte empêche de précalculer une table valable pour tous les
     * comptes : qui vole la base doit s'attaquer à chacun séparément.
     */
    public static SecretKey deriveSyncKey(@NonNull String masterKey, @NonNull byte[] kdfSalt)
            throws GeneralSecurityException {
        if (kdfSalt.length != SALT_BYTES) {
            throw new GeneralSecurityException("Sel du compte invalide");
        }
        return pbkdf2(masterKey, concat(SYNC_KDF_LABEL, kdfSalt));
    }

    /**
     * Données associées d'une entrée : la lient à son identifiant en clair.
     *
     * Sans elles, le serveur pourrait échanger les blobs de deux entrées sans
     * que rien ne le trahisse au déchiffrement.
     */
    public static byte[] entryAad(@NonNull String entryId) {
        return utf8(ENTRY_AAD_PREFIX + entryId);
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

    public static Sealed seal(@NonNull SecretKey key, @NonNull byte[] plain, @NonNull byte[] aad)
            throws GeneralSecurityException {
        // Un nonce jamais réutilisé avec la même clef : le contraire casse
        // AES-GCM.
        byte[] nonce = new byte[NONCE_BYTES];
        RANDOM.nextBytes(nonce);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, nonce));
        cipher.updateAAD(aad);
        return new Sealed(nonce, cipher.doFinal(plain));
    }

    public static Sealed seal(@NonNull SecretKey key, @NonNull String plain, @NonNull byte[] aad)
            throws GeneralSecurityException {
        return seal(key, utf8(plain), aad);
    }

    /**
     * Déchiffre en octets.
     *
     * Le contenu d'un transfert est compressé, donc binaire : passer par une
     * String UTF-8 corromprait les octets qui ne forment pas du texte valide.
     */
    public static byte[] openBytes(@NonNull SecretKey key, @NonNull byte[] nonce,
                                   @NonNull byte[] blob, @NonNull byte[] aad)
            throws GeneralSecurityException {
        if (nonce.length != NONCE_BYTES) {
            throw new GeneralSecurityException("Nonce de " + NONCE_BYTES + " octets attendu");
        }
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, nonce));
        cipher.updateAAD(aad);
        return cipher.doFinal(blob);
    }

    /** Déchiffre du texte. Pour du binaire, voir {@link #openBytes}. */
    public static String open(@NonNull SecretKey key, @NonNull byte[] nonce, @NonNull byte[] blob,
                              @NonNull byte[] aad) throws GeneralSecurityException {
        return new String(openBytes(key, nonce, blob, aad), StandardCharsets.UTF_8);
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

        // Le prefixe « TC2. » est porte une fois par le reassemblage, pas par
        // chaque fragment.
        String body = payload.substring(PREFIX.length() + 1);
        int total = (body.length() + FRAGMENT_LIMIT - 1) / FRAGMENT_LIMIT;
        for (int i = 0; i < total; i++) {
            int from = i * FRAGMENT_LIMIT;
            int to = Math.min(from + FRAGMENT_LIMIT, body.length());
            out.add(MULTIPART_PREFIX + "." + i + "." + total + "." + body.substring(from, to));
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

    /** zlib (en-tête et Adler-32, RFC 1950), pour qu'un carnet de cinquante entrees tienne dans un QR. */
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

        // Un sel propre à chaque export : pas de table précalculée valable
        // pour tous les carnets.
        byte[] salt = new byte[SALT_BYTES];
        RANDOM.nextBytes(salt);
        Sealed sealed = seal(deriveTransferKey(masterKey, salt), compressed, TRANSFER_AAD);

        return PREFIX + "." + Base64Url.encode(salt) + "." + Base64Url.encode(sealed.nonce)
                + "." + Base64Url.encode(sealed.blob);
    }

    /** Dechiffre un payload. Leve TransferException s'il est illisible. */
    public static Vault importVault(@NonNull String payload, @NonNull String masterKey)
            throws TransferException {
        String[] parts = payload.trim().split("\\.", -1);
        if (parts.length >= 3 && !PREFIX.equals(parts[0])) {
            // Interpreter un format inconnu au hasard serait pire que refuser.
            throw new TransferException(
                    "Version « " + parts[0] + " » inconnue, ce client lit " + PREFIX + ".");
        }
        if (parts.length != 4) {
            throw new TransferException(
                    "Format inattendu : " + PREFIX + ".<sel>.<nonce>.<donnees> attendu.");
        }

        byte[] salt;
        byte[] nonce;
        byte[] blob;
        try {
            salt = Base64Url.decode(parts[1]);
            nonce = Base64Url.decode(parts[2]);
            blob = Base64Url.decode(parts[3]);
        } catch (IllegalArgumentException e) {
            throw new TransferException("Format inattendu : base64url invalide.");
        }
        if (salt.length != SALT_BYTES || nonce.length != NONCE_BYTES) {
            throw new TransferException("Format inattendu : sel de " + SALT_BYTES
                    + " octets et nonce de " + NONCE_BYTES + " attendus.");
        }

        byte[] plain;
        try {
            plain = openBytes(deriveTransferKey(masterKey, salt), nonce, blob, TRANSFER_AAD);
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
