package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Synchronisation partielle : choix des entrées poussées, vérifié contre les
 * cas partagés (shared/spec/vault-sync.md, « Synchronisation partielle »).
 *
 * Deux clients qui ne choisissent pas les mêmes entrées se renverraient sans
 * fin des refus de plafond.
 *
 * Cas synchronisés depuis shared/vault-fixtures ; ne jamais les éditer ici.
 */
public class SyncSelectionTest {

    private static JSONObject loadSpec() throws Exception {
        try (InputStream in = SyncSelectionTest.class.getClassLoader()
                .getResourceAsStream("sync-selection.json")) {
            assertTrue("sync-selection.json absent du classpath (lancer: make sync-shared)",
                    in != null);
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) buf.write(chunk, 0, n);
            return new JSONObject(new String(buf.toByteArray(), StandardCharsets.UTF_8));
        }
    }

    private static List<String> strings(JSONArray array) throws Exception {
        List<String> out = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) out.add(array.getString(i));
        return out;
    }

    private static List<String> ids(List<VaultEntry> entries) {
        List<String> out = new ArrayList<>();
        for (VaultEntry e : entries) out.add(e.id);
        return out;
    }

    @Test
    public void everySharedCaseMatches() throws Exception {
        JSONArray cases = loadSpec().getJSONArray("cases");
        List<String> problems = new ArrayList<>();

        for (int i = 0; i < cases.length(); i++) {
            JSONObject c = cases.getJSONObject(i);
            Vault.PushSelection got = Vault.selectForPush(
                    Vault.fromJson(c.getJSONObject("vault").toString()),
                    strings(c.getJSONArray("remoteIds")), c.getInt("maxEntries"));

            if (!ids(got.push).equals(strings(c.getJSONArray("push")))) {
                problems.add(c.getString("id") + " : push " + ids(got.push));
            }
            if (!ids(got.localOnly).equals(strings(c.getJSONArray("localOnly")))) {
                problems.add(c.getString("id") + " : localOnly " + ids(got.localOnly));
            }
        }

        assertEquals("Ecart avec les cas partages : " + problems, 0, problems.size());
    }
}
