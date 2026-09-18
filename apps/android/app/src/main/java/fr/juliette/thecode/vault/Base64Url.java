package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;

/**
 * Base64 « url-safe », sans remplissage.
 *
 * C'est l'encodage que l'API attend, et que les quatre autres implémentations
 * produisent.
 *
 * Écrit à la main plutôt que d'appeler {@code java.util.Base64}, qui demande
 * l'API 26 alors que l'application descend à 21 : l'appel compilerait et
 * planterait sur les appareils anciens. {@code android.util.Base64} conviendrait
 * mais reste un stub dans les tests unitaires, où ce code doit être vérifiable.
 */
final class Base64Url {

    private static final char[] ALPHABET =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".toCharArray();

    private static final int[] INVERSE = new int[128];

    static {
        for (int i = 0; i < INVERSE.length; i++) INVERSE[i] = -1;
        for (int i = 0; i < ALPHABET.length; i++) INVERSE[ALPHABET[i]] = i;
        // Tolérance en lecture seulement : un payload venu d'ailleurs peut
        // porter l'alphabet standard. On n'en produit jamais.
        INVERSE['+'] = 62;
        INVERSE['/'] = 63;
    }

    private Base64Url() {}

    static String encode(@NonNull byte[] raw) {
        StringBuilder out = new StringBuilder((raw.length * 4 + 2) / 3);
        for (int i = 0; i < raw.length; i += 3) {
            int remaining = raw.length - i;
            int block = (raw[i] & 0xFF) << 16;
            if (remaining > 1) block |= (raw[i + 1] & 0xFF) << 8;
            if (remaining > 2) block |= raw[i + 2] & 0xFF;

            out.append(ALPHABET[(block >>> 18) & 0x3F]);
            out.append(ALPHABET[(block >>> 12) & 0x3F]);
            // Le dernier groupe est tronqué au lieu d'être complété par « = » :
            // sans remplissage, la longueur dit déjà combien d'octets suivent.
            if (remaining > 1) out.append(ALPHABET[(block >>> 6) & 0x3F]);
            if (remaining > 2) out.append(ALPHABET[block & 0x3F]);
        }
        return out.toString();
    }

    /**
     * @throws IllegalArgumentException si l'entrée n'est pas du base64 valide.
     *     Ignorer les caractères inconnus rendrait un contenu tronqué que
     *     personne ne remarquerait avant de constater un carnet incomplet.
     */
    static byte[] decode(@NonNull String value) {
        int length = value.length();
        while (length > 0 && value.charAt(length - 1) == '=') length--;

        int bytes = length * 3 / 4;
        if (length % 4 == 1) {
            throw new IllegalArgumentException("Base64 tronqué : " + length + " caractères");
        }

        byte[] out = new byte[bytes];
        int block = 0;
        int bits = 0;
        int written = 0;
        for (int i = 0; i < length; i++) {
            char c = value.charAt(i);
            int digit = c < INVERSE.length ? INVERSE[c] : -1;
            if (digit < 0) {
                throw new IllegalArgumentException("Caractère invalide en base64 : " + c);
            }
            block = (block << 6) | digit;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                out[written++] = (byte) ((block >>> bits) & 0xFF);
            }
        }
        return out;
    }
}
