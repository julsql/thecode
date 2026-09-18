package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Forme canonique d'une entrée.
 *
 * Elle départage deux écritures au même horodatage. Deux implémentations qui
 * n'écrivent pas la même chaîne désignent un gagnant différent et ne convergent
 * jamais — les tests par plateforme ont déjà laissé passer exactement ce genre
 * d'écart, d'où le fichier partagé.
 *
 * Spécification : shared/spec/vault-merge.md
 */
public class CanonicalFormTest {

    private static JSONArray cases() throws Exception {
        try (InputStream in = CanonicalFormTest.class.getClassLoader()
                .getResourceAsStream("canonical-entries.json")) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) buf.write(chunk, 0, n);
            return new JSONObject(new String(buf.toByteArray(), StandardCharsets.UTF_8))
                    .getJSONArray("cases");
        }
    }

    private static VaultEntry entryOf(JSONObject testCase) throws Exception {
        return VaultEntry.fromJson(testCase.getJSONObject("entry"));
    }

    @Test
    public void matchesTheSharedFixture() throws Exception {
        JSONArray cases = cases();
        for (int i = 0; i < cases.length(); i++) {
            JSONObject testCase = cases.getJSONObject(i);
            assertEquals(testCase.getString("name"),
                    testCase.getString("canonical"), entryOf(testCase).canonical());
        }
    }

    @Test
    public void isCompactAndSortedAtEveryLevel() throws Exception {
        String out = entryOf(cases().getJSONObject(0)).canonical();

        assertFalse(out, out.contains("\": "));
        // JSONObject.toString() n'aurait trié aucune clef.
        assertTrue(out,
                out.contains("\"charset\":{\"lower\":true,\"numbers\":true,"
                        + "\"symbols\":true,\"upper\":true}"));
    }

    @Test
    public void dropsAFalseDeletedAndKeepsATrueOne() throws Exception {
        JSONArray cases = cases();
        for (int i = 0; i < cases.length(); i++) {
            JSONObject testCase = cases.getJSONObject(i);
            String out = entryOf(testCase).canonical();

            if ("deleted-vrai-conserve".equals(testCase.getString("name"))) {
                assertTrue(out, out.contains("\"deleted\":true"));
            } else if ("deleted-faux-retire".equals(testCase.getString("name"))) {
                assertFalse(out, out.contains("deleted"));
            }
        }
    }

    @Test
    public void leavesSlashesAndAccentsAsTheyAre() throws Exception {
        JSONArray cases = cases();
        for (int i = 0; i < cases.length(); i++) {
            JSONObject testCase = cases.getJSONObject(i);
            if (!"accents-et-slash".equals(testCase.getString("name"))) continue;

            String out = entryOf(testCase).canonical();
            // org.json échappe « / » : c'est précisément ce qu'il ne faut pas.
            assertTrue(out, out.contains("site.fr/chemin"));
            assertFalse(out, out.contains("\\u"));
            assertTrue(out, out.contains("Café"));
            return;
        }
        throw new AssertionError("cas « accents-et-slash » absent de la fixture");
    }
}
