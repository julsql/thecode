package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import javax.crypto.SecretKey;

/**
 * Interopérabilité du format de synchronisation v2.
 *
 * Le vecteur vient du CLI Python. Ce qui a déjà cassé deux fois n'est pas le
 * chiffrement mais le JSON autour : un champ inventé, un défaut ajouté, et la
 * fusion diverge d'un appareil à l'autre. Les cas {@code rejected} vérifient
 * que chaque bloc reste lié à son usage et à son identifiant.
 */
public class SyncInteropTest {

    static JSONObject vector() throws Exception {
        try (InputStream in = SyncInteropTest.class.getClassLoader()
                .getResourceAsStream("sync-row.json")) {
            assertTrue("sync-row.json absent", in != null);
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) buf.write(chunk, 0, n);
            return new JSONObject(new String(buf.toByteArray(), StandardCharsets.UTF_8));
        }
    }

    private static SecretKey key(JSONObject v) throws Exception {
        return Transfer.deriveSyncKey(v.getString("masterKey"),
                Base64Url.decode(v.getString("kdfSalt")));
    }

    private static String hex(byte[] raw) {
        StringBuilder out = new StringBuilder();
        for (byte b : raw) out.append(String.format("%02x", b));
        return out.toString();
    }

    @Test
    public void derivesTheSameSyncKey() throws Exception {
        JSONObject v = vector();
        assertEquals(v.getString("derivedSyncHex"), hex(key(v).getEncoded()));
    }

    @Test
    public void bindsEntriesToTheirIdentifier() throws Exception {
        JSONObject v = vector();
        assertEquals(v.getString("entryAad"), new String(
                Transfer.entryAad(v.getJSONObject("entry").getString("id")),
                StandardCharsets.UTF_8));
        assertEquals(v.getJSONObject("settings").getString("aad"),
                new String(Transfer.SETTINGS_AAD, StandardCharsets.UTF_8));
    }

    @Test
    public void decryptsARowProducedByAnotherImplementation() throws Exception {
        JSONObject v = vector();
        JSONObject row = v.getJSONObject("row");

        VaultEntry entry = Sync.openEntry(row, key(v));
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
    public void opensSettingsProducedByAnotherImplementation() throws Exception {
        JSONObject v = vector();
        JSONObject settings = v.getJSONObject("settings");

        DefaultSettings opened = Sync.openSettings(settings.getJSONObject("sealed"), key(v));

        JSONObject value = settings.getJSONObject("value");
        JSONObject charset = value.getJSONObject("charset");
        assertEquals(value.getInt("length"), opened.length);
        assertEquals(charset.getBoolean("lower"), opened.lower);
        assertEquals(charset.getBoolean("upper"), opened.upper);
        assertEquals(charset.getBoolean("symbols"), opened.symbols);
        assertEquals(charset.getBoolean("numbers"), opened.numbers);
        assertEquals(value.getString("updatedAt"), opened.updatedAt);
    }

    @Test
    public void rejectsEveryMisboundBlock() throws Exception {
        JSONObject v = vector();
        SecretKey key = key(v);
        JSONArray rejected = v.getJSONArray("rejected");
        assertTrue(rejected.length() > 0);

        for (int i = 0; i < rejected.length(); i++) {
            JSONObject c = rejected.getJSONObject(i);
            String as = c.getString("as");
            try {
                if ("entry".equals(as)) {
                    Sync.openEntry(c.getJSONObject("row"), key);
                } else if ("settings".equals(as)) {
                    Sync.openSettings(c.getJSONObject("row"), key);
                } else {
                    fail("cas inconnu : " + as);
                }
                fail(c.getString("name") + " accepté : " + c.getString("why"));
            } catch (java.security.GeneralSecurityException | org.json.JSONException expected) {
                // Refusé, comme attendu.
            }
        }
    }

    @Test
    public void reEncryptsToSomethingTheOthersCanRead() throws Exception {
        // Le nonce change à chaque chiffrement : on ne peut pas comparer les
        // octets, seulement vérifier que le tour complet rend le même JSON.
        JSONObject v = vector();
        SecretKey key = key(v);
        VaultEntry entry = Sync.openEntry(v.getJSONObject("row"), key);

        Transfer.Sealed sealed = Transfer.seal(key, entry.toJson().toString(),
                Transfer.entryAad(entry.id));
        JSONObject row = new JSONObject()
                .put("entry_id", entry.id)
                .put("nonce", Base64Url.encode(sealed.nonce))
                .put("blob", Base64Url.encode(sealed.blob));

        assertEquals(entry.toJson().toString(), Sync.openEntry(row, key).toJson().toString());
    }

    @Test
    public void theAccountSaltChangesTheKey() throws Exception {
        JSONObject v = vector();
        byte[] other = new byte[Transfer.SALT_BYTES];
        assertNotEquals(hex(key(v).getEncoded()),
                hex(Transfer.deriveSyncKey(v.getString("masterKey"), other).getEncoded()));
    }
}
