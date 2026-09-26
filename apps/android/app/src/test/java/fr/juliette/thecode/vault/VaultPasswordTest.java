package fr.juliette.thecode.vault;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

/** Empreinte du mot de passe de carnet (shared/spec/vault-lock.md). */
public class VaultPasswordTest {

    @Test
    public void recordHasTheSpecifiedShape() throws Exception {
        JSONObject o = new JSONObject(VaultPassword.hash("correct horse".toCharArray()));

        assertEquals(1, o.getInt("v"));
        assertEquals(16, Base64Url.decode(o.getString("salt")).length);
        assertEquals(32, Base64Url.decode(o.getString("hash")).length);
        assertEquals(3, o.length());
    }

    @Test
    public void verifiesTheRightPasswordOnly() {
        String record = VaultPassword.hash("correct horse".toCharArray());

        assertTrue(VaultPassword.verify("correct horse".toCharArray(), record));
        assertFalse(VaultPassword.verify("correct hors".toCharArray(), record));
        assertFalse(VaultPassword.verify("".toCharArray(), record));
    }

    @Test
    public void saltIsRandomSoSamePasswordGivesDifferentRecords() {
        String a = VaultPassword.hash("same password".toCharArray());
        String b = VaultPassword.hash("same password".toCharArray());
        assertNotEquals(a, b);
    }

    @Test
    public void derivationMatchesPbkdf2Sha256Vector() {
        // RFC 7914 §11, PBKDF2-HMAC-SHA256 : P="passwd", S="salt", c=1, dkLen=64.
        byte[] dk = VaultPassword.derive("passwd".toCharArray(),
                "salt".getBytes(java.nio.charset.StandardCharsets.US_ASCII), 1);
        byte[] expected = hex("55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc");
        assertArrayEquals(expected, dk);
    }

    @Test
    public void rejectsMissingOrCorruptRecords() {
        char[] pw = "whatever1".toCharArray();
        assertFalse(VaultPassword.verify(pw, null));
        assertFalse(VaultPassword.verify(pw, ""));
        assertFalse(VaultPassword.verify(pw, "not json"));
        assertFalse(VaultPassword.verify(pw, "{\"v\":2,\"salt\":\"AAAA\",\"hash\":\"AAAA\"}"));
        assertFalse(VaultPassword.verify(pw, "{\"v\":1,\"salt\":\"AAAA\",\"hash\":\"AAAA\"}"));
    }

    @Test
    public void newPasswordNeedsEightCharactersTypedTwice() {
        assertEquals(VaultPassword.Check.TOO_SHORT, VaultPassword.checkNew("1234567", "1234567"));
        assertEquals(VaultPassword.Check.MISMATCH, VaultPassword.checkNew("12345678", "12345679"));
        assertEquals(VaultPassword.Check.OK, VaultPassword.checkNew("12345678", "12345678"));
    }

    private static byte[] hex(String s) {
        byte[] out = new byte[s.length() / 2];
        for (int i = 0; i < out.length; i++) {
            out[i] = (byte) Integer.parseInt(s.substring(2 * i, 2 * i + 2), 16);
        }
        return out;
    }
}
