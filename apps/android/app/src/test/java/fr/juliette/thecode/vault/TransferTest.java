package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

import java.util.HashSet;
import java.util.Set;

import javax.crypto.SecretKey;

/** Chiffrement du carnet avant transfert. */
public class TransferTest {

    private static final byte[] SALT = new byte[Transfer.SALT_BYTES];
    private static final byte[] AAD = Transfer.TRANSFER_AAD;

    private static SecretKey key(String masterKey) throws Exception {
        return Transfer.deriveTransferKey(masterKey, SALT);
    }

    @Test
    public void roundTrips() throws Exception {
        SecretKey key = key("clef");
        Transfer.Sealed sealed = Transfer.seal(key, "{\"site\":\"google.com\"}", AAD);
        assertEquals("{\"site\":\"google.com\"}", Transfer.open(key, sealed.nonce, sealed.blob, AAD));
    }

    @Test
    public void aWrongKeyCannotOpenIt() throws Exception {
        Transfer.Sealed sealed = Transfer.seal(key("clef"), "secret", AAD);
        try {
            Transfer.open(key("mauvaise"), sealed.nonce, sealed.blob, AAD);
            fail("une mauvaise clef ne doit pas dechiffrer");
        } catch (Exception expected) {
            // AES-GCM authentifie : il refuse, il ne rend pas du contenu faux.
        }
    }

    @Test
    public void tamperingIsDetected() throws Exception {
        SecretKey key = key("clef");
        Transfer.Sealed sealed = Transfer.seal(key, "secret", AAD);
        sealed.blob[0] ^= 0x01;
        try {
            Transfer.open(key, sealed.nonce, sealed.blob, AAD);
            fail("un octet modifie doit faire echouer, pas produire du contenu corrompu");
        } catch (Exception expected) {
            // Attendu.
        }
    }

    @Test
    public void nonceIsNeverReused() throws Exception {
        // Reutiliser un nonce avec la meme clef casse AES-GCM.
        SecretKey key = key("clef");
        Set<String> nonces = new HashSet<>();
        for (int i = 0; i < 20; i++) {
            nonces.add(java.util.Arrays.toString(Transfer.seal(key, "x", AAD).nonce));
        }
        assertEquals(20, nonces.size());
    }

    @Test
    public void theSealedBlobRevealsNothing() throws Exception {
        Transfer.Sealed sealed = Transfer.seal(key("clef"), "google.com", AAD);
        String asText = new String(sealed.blob, java.nio.charset.StandardCharsets.ISO_8859_1);
        assertTrue("le domaine ne doit pas transparaitre", asText.indexOf("google") < 0);
    }

    @Test
    public void differsFromThePasswordDerivation() throws Exception {
        // Sel distinct : une meme valeur derivee ne doit pas servir a deux
        // usages, sinon une faiblesse sur l'un exposerait l'autre.
        assertNotEquals(
                java.util.Arrays.toString(key("clef").getEncoded()),
                java.util.Arrays.toString(Fingerprint4Test.derive("clef")));
    }

    @Test
    public void anotherUsageCannotOpenIt() throws Exception {
        // Données associées distinctes : un bloc chiffré pour un usage ne se
        // lit pas comme un autre, même sous la même clef.
        SecretKey key = key("clef");
        Transfer.Sealed sealed = Transfer.seal(key, "secret", Transfer.SETTINGS_AAD);
        try {
            Transfer.open(key, sealed.nonce, sealed.blob, Transfer.entryAad("x"));
            fail("des donnees associees differentes doivent faire echouer");
        } catch (Exception expected) {
            // Attendu.
        }
    }

    @Test
    public void syncAndTransferKeysDiffer() throws Exception {
        assertNotEquals(
                java.util.Arrays.toString(key("clef").getEncoded()),
                java.util.Arrays.toString(Transfer.deriveSyncKey("clef", SALT).getEncoded()));
    }

    /** Petit miroir de la derivation d'empreinte, pour comparer les sels. */
    private static final class Fingerprint4Test {
        static byte[] derive(String key) throws Exception {
            javax.crypto.spec.PBEKeySpec spec = new javax.crypto.spec.PBEKeySpec(
                    key.toCharArray(),
                    "thecode-fingerprint/v1".getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    600_000, 256);
            return javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(spec).getEncoded();
        }
    }
}
