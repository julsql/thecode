package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import javax.crypto.SecretKey;

import fr.juliette.thecode.Code;
import fr.juliette.thecode.CodeV2;
import fr.juliette.thecode.Generator;

/**
 * Une entrée ne porte pas de version : un « v » résiduel est ignoré.
 *
 * Toute entrée du carnet dérive en v2. Un champ {@code v} lu (chargement,
 * import, synchronisation, fusion) est toléré, retiré, et jamais réécrit.
 * Voir shared/spec/vault-merge.md.
 */
public class StrayVersionTest {

    private static final Sync.Credentials CREDS =
            new Sync.Credentials("https://example.test/api", "access-1", "refresh-0");

    private static JSONObject strayEntry(int v) throws Exception {
        VaultEntry entry = VaultEntry.create("google.com", List.of("google.com"));
        entry.login = "moi";
        return entry.toJson().put("v", v);
    }

    private static String strayVault(int v) throws Exception {
        JSONObject entry = strayEntry(v);
        return new JSONObject()
                .put("schema", Vault.SCHEMA)
                .put("updatedAt", entry.getString("updatedAt"))
                .put("entries", new JSONArray().put(entry))
                .toString();
    }

    private static boolean hasV(Vault vault) throws Exception {
        JSONArray entries = new JSONObject(vault.toCompactJson()).getJSONArray("entries");
        for (int i = 0; i < entries.length(); i++) {
            if (entries.getJSONObject(i).has("v")) return true;
        }
        return false;
    }

    @Test
    public void aNewEntryHasNoVersion() throws Exception {
        assertFalse(VaultEntry.create("site.fr", null).toJson().has("v"));
    }

    @Test
    public void loadKeepsTheEntryAndDropsV() throws Exception {
        for (int v : new int[] {1, 2, 3}) {
            Vault loaded = Vault.fromJson(strayVault(v));

            assertEquals("v=" + v, 1, loaded.entries.size());
            assertFalse("v=" + v, hasV(loaded));
        }
    }

    @Test
    public void saveNeverWritesVBack() throws Exception {
        Vault reloaded = Vault.fromJson(Vault.fromJson(strayVault(1)).toCompactJson());

        assertEquals(1, reloaded.entries.size());
        assertFalse(hasV(reloaded));
    }

    @Test
    public void importDropsV() throws Exception {
        Vault imported = Transfer.importVault(Transfer.exportJson(strayVault(1), "clef"), "clef");

        assertEquals(1, imported.entries.size());
        assertFalse(hasV(imported));
    }

    @Test
    public void mergeDropsV() throws Exception {
        Vault merged = Vault.merge(new Vault(), Vault.fromJson(strayVault(1)), new ArrayList<>());

        assertEquals(1, merged.entries.size());
        assertFalse(hasV(merged));
    }

    @Test
    public void syncDropsV() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        SecretKey key = Transfer.deriveKey("clef");
        JSONObject entry = strayEntry(1);
        Transfer.Sealed sealed = Transfer.seal(key, entry.toString());
        server.seed(new JSONObject()
                .put("entry_id", entry.getString("id"))
                .put("nonce", Base64Url.encode(sealed.nonce))
                .put("blob", Base64Url.encode(sealed.blob))
                .put("deleted", false));

        Vault local = new Vault();
        local.entries.add(VaultEntry.create("github.com", null));
        Vault merged = new Sync(server).sync(local, "clef", CREDS).vault;

        assertEquals(2, merged.entries.size());
        assertFalse(hasV(merged));

        int pushed = 0;
        for (String body : server.sentBodies) {
            JSONObject payload = new JSONObject(body);
            JSONArray rows = payload.optJSONArray("entries");
            if (rows == null) continue;
            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.getJSONObject(i);
                String plain = new String(Transfer.openBytes(key,
                        Base64Url.decode(row.getString("nonce")),
                        Base64Url.decode(row.getString("blob"))), StandardCharsets.UTF_8);
                assertFalse(plain, new JSONObject(plain).has("v"));
                pushed++;
            }
        }
        assertTrue(pushed > 0);
    }

    @Test
    public void anEntryWithAStrayV1StillDerivesV2() throws Exception {
        VaultEntry entry = Vault.fromJson(strayVault(1)).entries.get(0);

        SiteResolution resolution = SiteResolution.of(entry);
        assertEquals(2, resolution.v);

        Code code = new Code();
        code.setLength(entry.length);
        String expected = CodeV2.getCode(code, "clef", "google.com", "moi", 1, null);
        assertEquals(expected, Generator.generate(resolution, "clef", null));
    }
}
