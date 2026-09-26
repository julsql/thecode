package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import java.util.Arrays;

import javax.crypto.SecretKey;

/**
 * Interopérabilité du format de synchronisation.
 *
 * Le vecteur vient du CLI Python. Ce qui a déjà cassé deux fois n'est pas le
 * chiffrement mais le JSON autour : un champ inventé, un défaut ajouté, et la
 * fusion diverge d'un appareil à l'autre.
 */
public class SyncInteropTest {

    private static JSONObject vector() throws Exception {
        try (InputStream in = SyncInteropTest.class.getClassLoader()
                .getResourceAsStream("sync-row.json")) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) buf.write(chunk, 0, n);
            return new JSONObject(new String(buf.toByteArray(), StandardCharsets.UTF_8));
        }
    }

    @Test
    public void decryptsARowProducedByAnotherImplementation() throws Exception {
        JSONObject v = vector();
        JSONObject row = v.getJSONObject("row");

        SecretKey key = Transfer.deriveKey(v.getString("masterKey"));
        byte[] plain = Transfer.openBytes(key,
                Base64Url.decode(row.getString("nonce")),
                Base64Url.decode(row.getString("blob")));

        VaultEntry entry = VaultEntry.fromJson(
                new JSONObject(new String(plain, StandardCharsets.UTF_8)));
        JSONObject expected = v.getJSONObject("entry");

        assertEquals(expected.getString("id"), entry.id);
        assertEquals(expected.getString("id"), row.getString("entry_id"));
        assertEquals(expected.getString("label"), entry.label);
        assertEquals(expected.getString("siteKey"), entry.siteKey);
        assertEquals(expected.getString("login"), entry.login);
        assertEquals(Arrays.asList("google.com", "google.fr"), entry.domains);
        assertEquals(expected.getInt("counter"), entry.counter);
        assertEquals(expected.getInt("length"), entry.length);
        assertFalse(entry.toJson().has("v"));
        assertEquals(expected.getString("updatedAt"), entry.updatedAt);
        assertFalse(entry.symbols);
        assertTrue(entry.numbers);
        assertFalse(entry.deleted);
    }

    @Test
    public void reEncryptsToSomethingTheOthersCanRead() throws Exception {
        // Le nonce change à chaque chiffrement : on ne peut pas comparer les
        // octets, seulement vérifier que le tour complet rend le même JSON.
        JSONObject v = vector();
        SecretKey key = Transfer.deriveKey(v.getString("masterKey"));

        VaultEntry entry = VaultEntry.fromJson(
                new JSONObject(new String(Transfer.openBytes(key,
                        Base64Url.decode(v.getJSONObject("row").getString("nonce")),
                        Base64Url.decode(v.getJSONObject("row").getString("blob"))),
                        StandardCharsets.UTF_8)));

        Transfer.Sealed sealed = Transfer.seal(key, entry.toJson().toString());
        String again = new String(
                Transfer.openBytes(key, sealed.nonce, sealed.blob), StandardCharsets.UTF_8);

        assertEquals(entry.toJson().toString(), again);
    }
}
