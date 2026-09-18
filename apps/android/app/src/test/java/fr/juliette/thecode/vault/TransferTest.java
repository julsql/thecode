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

    @Test
    public void roundTrips() throws Exception {
        SecretKey key = Transfer.deriveKey("clef");
        Transfer.Sealed sealed = Transfer.seal(key, "{\"site\":\"google.com\"}");
        assertEquals("{\"site\":\"google.com\"}", Transfer.open(key, sealed.nonce, sealed.blob));
    }

    @Test
    public void aWrongKeyCannotOpenIt() throws Exception {
        Transfer.Sealed sealed = Transfer.seal(Transfer.deriveKey("clef"), "secret");
        try {
            Transfer.open(Transfer.deriveKey("mauvaise"), sealed.nonce, sealed.blob);
            fail("une mauvaise clef ne doit pas dechiffrer");
        } catch (Exception expected) {
            // AES-GCM authentifie : il refuse, il ne rend pas du contenu faux.
        }
    }

    @Test
    public void tamperingIsDetected() throws Exception {
        SecretKey key = Transfer.deriveKey("clef");
        Transfer.Sealed sealed = Transfer.seal(key, "secret");
        sealed.blob[0] ^= 0x01;
        try {
            Transfer.open(key, sealed.nonce, sealed.blob);
            fail("un octet modifie doit faire echouer, pas produire du contenu corrompu");
        } catch (Exception expected) {
            // Attendu.
        }
    }

    @Test
    public void nonceIsNeverReused() throws Exception {
        // Reutiliser un nonce avec la meme clef casse AES-GCM.
        SecretKey key = Transfer.deriveKey("clef");
        Set<String> nonces = new HashSet<>();
        for (int i = 0; i < 20; i++) {
            nonces.add(java.util.Arrays.toString(Transfer.seal(key, "x").nonce));
        }
        assertEquals(20, nonces.size());
    }

    @Test
    public void theSealedBlobRevealsNothing() throws Exception {
        Transfer.Sealed sealed = Transfer.seal(Transfer.deriveKey("clef"), "google.com");
        String asText = new String(sealed.blob, java.nio.charset.StandardCharsets.ISO_8859_1);
        assertTrue("le domaine ne doit pas transparaitre", asText.indexOf("google") < 0);
    }

    @Test
    public void differsFromThePasswordDerivation() throws Exception {
        // Sel distinct : une meme valeur derivee ne doit pas servir a deux
        // usages, sinon une faiblesse sur l'un exposerait l'autre.
        assertNotEquals(
                java.util.Arrays.toString(Transfer.deriveKey("clef").getEncoded()),
                java.util.Arrays.toString(Fingerprint4Test.derive("clef")));
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
