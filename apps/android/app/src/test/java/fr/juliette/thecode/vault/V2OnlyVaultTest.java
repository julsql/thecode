package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import javax.crypto.SecretKey;

/**
 * Le carnet n'admet que la v2 : shared/spec/vault-merge.md, vecteur
 * shared/vault-fixtures/v2-only.json.
 *
 * Chaque chemin de lecture (chargement, transfert, synchronisation) doit écarter
 * les entrées hors v2 sans faire échouer le reste du carnet.
 */
public class V2OnlyVaultTest {

    private static final Sync.Credentials CREDS =
            new Sync.Credentials("https://example.test/api", "access-1", "refresh-0");

    private static JSONObject fixture() throws Exception {
        try (InputStream in = V2OnlyVaultTest.class.getClassLoader()
                .getResourceAsStream("v2-only.json")) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) buf.write(chunk, 0, n);
            return new JSONObject(new String(buf.toByteArray(), StandardCharsets.UTF_8));
        }
    }

    private static List<String> expectedIds(JSONObject fixture) throws Exception {
        JSONArray ids = fixture.getJSONArray("expectedIds");
        List<String> out = new ArrayList<>();
        for (int i = 0; i < ids.length(); i++) out.add(ids.getString(i));
        return out;
    }

    private static List<String> idsOf(Vault vault) {
        List<String> out = new ArrayList<>();
        for (VaultEntry e : vault.entries) out.add(e.id);
        return out;
    }

    @Test
    public void loadingKeepsOnlyV2Entries() throws Exception {
        JSONObject fixture = fixture();
        Vault vault = Vault.fromJson(fixture.getJSONObject("vault").toString());
        assertEquals(expectedIds(fixture), idsOf(vault));
    }

    @Test
    public void importingKeepsOnlyV2Entries() throws Exception {
        JSONObject fixture = fixture();
        String payload = Transfer.exportJson(fixture.getJSONObject("vault").toString(), "clef");
        assertEquals(expectedIds(fixture), idsOf(Transfer.importVault(payload, "clef")));
    }

    @Test
    public void syncingKeepsOnlyV2EntriesAndPushesNoOther() throws Exception {
        JSONObject fixture = fixture();
        SecretKey key = Transfer.deriveKey("clef");
        FakeVaultServer server = new FakeVaultServer();
        JSONArray entries = fixture.getJSONObject("vault").getJSONArray("entries");
        for (int i = 0; i < entries.length(); i++) {
            JSONObject entry = entries.getJSONObject(i);
            Transfer.Sealed sealed = Transfer.seal(key, entry.toString());
            server.seed(new JSONObject()
                    .put("entry_id", entry.getString("id"))
                    .put("nonce", Base64Url.encode(sealed.nonce))
                    .put("blob", Base64Url.encode(sealed.blob))
                    .put("deleted", false));
        }

        Vault merged = new Sync(server).sync(new Vault(), "clef", CREDS).vault;

        assertEquals(expectedIds(fixture), idsOf(merged));
        String pushed = server.sentBodies.get(server.sentBodies.size() - 1);
        JSONArray rows = new JSONObject(pushed).getJSONArray("entries");
        assertEquals(1, rows.length());
        assertEquals(expectedIds(fixture).get(0), rows.getJSONObject(0).getString("entry_id"));
    }

    @Test
    public void writingRefusesAnythingButV2() throws Exception {
        Vault vault = new Vault();
        VaultEntry v1 = VaultEntry.create("vieux.fr", null);
        v1.v = 1;
        vault.entries.add(v1);
        vault.entries.add(VaultEntry.create("neuf.fr", null));

        String json = vault.toJson();

        assertFalse(json, json.contains("vieux.fr"));
        assertEquals(1, Vault.fromJson(json).entries.size());
    }

    @Test
    public void upsertNeverDowngradesAnEntry() {
        Vault vault = new Vault();
        VaultEntry entry = vault.upsert("google.com", 20, true, true, true, true);
        entry.v = 1; // un état qu'aucun chemin ne doit plus produire ni garder

        VaultEntry again = vault.upsert("google.com", 24, true, true, false, true);

        assertNotNull(again);
        assertEquals(2, again.v);
        assertEquals(1, vault.entries.size());
    }
}
