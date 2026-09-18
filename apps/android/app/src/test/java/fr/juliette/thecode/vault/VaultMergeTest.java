package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * Carnet : fusion vérifiée contre les cas partagés.
 *
 * La règle doit être identique sur les cinq implémentations : deux appareils
 * qui fusionnent les mêmes carnets doivent aboutir au même résultat, sinon ils
 * repartent en divergence à la synchronisation suivante.
 *
 * Fichier synchronisé depuis shared/ ; ne jamais l'éditer directement.
 */
public class VaultMergeTest {

    private static JSONObject loadSpec() throws Exception {
        try (InputStream in = VaultMergeTest.class.getClassLoader()
                .getResourceAsStream("merge-cases.json")) {
            assertTrue("merge-cases.json absent du classpath (lancer: make sync-shared)",
                    in != null);
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) buf.write(chunk, 0, n);
            return new JSONObject(new String(buf.toByteArray(), StandardCharsets.UTF_8));
        }
    }

    private static Vault vaultOf(JSONObject o) throws Exception {
        return Vault.fromJson(o.toString());
    }

    /** Compare deux carnets sur ce qui compte, indépendamment de l'ordre. */
    private static List<String> signature(Vault v) throws Exception {
        List<String> out = new ArrayList<>();
        for (VaultEntry e : v.entries) out.add(e.toJson().toString());
        java.util.Collections.sort(out);
        return out;
    }

    @Test
    public void everySharedCaseMatches() throws Exception {
        JSONArray cases = loadSpec().getJSONArray("cases");
        List<String> problems = new ArrayList<>();

        for (int i = 0; i < cases.length(); i++) {
            JSONObject c = cases.getJSONObject(i);
            List<Vault.Conflict> conflicts = new ArrayList<>();
            Vault got = Vault.merge(vaultOf(c.getJSONObject("left")),
                    vaultOf(c.getJSONObject("right")), conflicts);

            List<String> want = signature(vaultOf(c.getJSONObject("expected")));
            if (!signature(got).equals(want)) {
                problems.add(c.getString("id") + "\n  obtenu : " + signature(got)
                        + "\n  attendu: " + want);
            }

            Set<String> kinds = new TreeSet<>();
            for (Vault.Conflict k : conflicts) kinds.add(k.kind);
            Set<String> wanted = new TreeSet<>();
            JSONArray expected = c.getJSONArray("conflicts");
            for (int j = 0; j < expected.length(); j++) wanted.add(expected.getString(j));
            if (!kinds.equals(wanted)) {
                problems.add(c.getString("id") + " : conflits " + kinds + " au lieu de " + wanted);
            }
        }

        assertEquals("Ecart avec les cas partages : " + problems, 0, problems.size());
    }

    @Test
    public void mergeIsCommutative() throws Exception {
        JSONArray cases = loadSpec().getJSONArray("cases");
        for (int i = 0; i < cases.length(); i++) {
            JSONObject c = cases.getJSONObject(i);
            // siteKey divergent est volontairement asymétrique : on garde celui
            // de gauche plutôt que de trancher à la place de l'utilisateur.
            if (c.getJSONArray("conflicts").toString().contains("sitekey-divergent")) continue;

            Vault left = vaultOf(c.getJSONObject("left"));
            Vault right = vaultOf(c.getJSONObject("right"));
            assertEquals(c.getString("id"),
                    signature(Vault.merge(left, right, new ArrayList<>())),
                    signature(Vault.merge(right, left, new ArrayList<>())));
        }
    }

    @Test
    public void mergeIsIdempotent() throws Exception {
        JSONArray cases = loadSpec().getJSONArray("cases");
        for (int i = 0; i < cases.length(); i++) {
            JSONObject c = cases.getJSONObject(i);
            Vault right = vaultOf(c.getJSONObject("right"));
            Vault once = Vault.merge(vaultOf(c.getJSONObject("left")), right, new ArrayList<>());
            Vault twice = Vault.merge(once, right, new ArrayList<>());
            assertEquals(c.getString("id"), signature(once), signature(twice));
        }
    }

    @Test
    public void oneAccountAcrossSeveralDomains() {
        Vault v = new Vault();
        v.entries.add(VaultEntry.create("google.com",
                List.of("google.com", "google.fr", "youtube.com")));
        for (String d : new String[]{"google.com", "google.fr", "youtube.com"}) {
            assertNotNull(d, v.findByDomain(d));
            assertEquals("google.com", v.findByDomain(d).siteKey);
        }
    }

    @Test
    public void severalAccountsOnOneSite() {
        Vault v = new Vault();
        v.entries.add(VaultEntry.create("google.com", List.of("google.com")));
        v.entries.add(VaultEntry.create("google.com#pro", List.of("google.com")));
        assertEquals(2, v.findAllByDomain("google.com").size());

        Set<String> keys = new HashSet<>();
        for (VaultEntry e : v.findAllByDomain("google.com")) keys.add(e.siteKey);
        assertEquals(Set.of("google.com", "google.com#pro"), keys);
    }

    @Test
    public void deletedEntriesAreNotReturned() {
        Vault v = new Vault();
        VaultEntry e = VaultEntry.create("google.com", null);
        e.deleted = true;
        v.entries.add(e);
        assertNull(v.findByDomain("google.com"));
    }

    @Test
    public void roundTripsThroughJson() throws Exception {
        Vault v = new Vault();
        v.entries.add(VaultEntry.create("google.com", List.of("google.com", "google.fr")));
        Vault back = Vault.fromJson(v.toJson());
        assertEquals(signature(v), signature(back));
    }
}
