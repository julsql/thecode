package fr.juliette.thecode.autofill;

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
 * Canonicalisation des hostnames, verifiee contre le referentiel partage
 * shared/canonical-site-cases.json.
 *
 * Deux implementations qui canonicalisent differemment produisent deux mots de
 * passe differents pour le meme site. Cette suite est croisee avec celles des
 * autres plateformes, contrairement a DomainNormalizerTest qui ne testait que
 * des cas choisis ici — aucun suffixe multi-niveaux, d'ou la divergence restee
 * invisible.
 *
 * Fichier synchronise depuis shared/ ; ne jamais l'editer directement.
 */
public class DomainCanonicalTest {

    private static final String IMPL = "android";

    private static JSONObject loadSpec() throws Exception {
        try (InputStream in = DomainCanonicalTest.class.getClassLoader()
                .getResourceAsStream("canonical-site-cases.json")) {
            assertTrue("canonical-site-cases.json absent du classpath de test "
                    + "(lancer: make sync-shared)", in != null);
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) {
                buf.write(chunk, 0, n);
            }
            return new JSONObject(new String(buf.toByteArray(), StandardCharsets.UTF_8));
        }
    }

    @Test
    public void specIsReadable() throws Exception {
        JSONObject root = loadSpec();
        assertEquals(1, root.getInt("schema"));
        assertTrue(root.getJSONArray("cases").length() > 0);
    }

    @Test
    public void behaviourMatchesTheSharedReference() throws Exception {
        JSONArray cases = loadSpec().getJSONArray("cases");
        List<String> problems = new ArrayList<>();

        for (int i = 0; i < cases.length(); i++) {
            JSONObject c = cases.getJSONObject(i);
            String hostname = c.getString("hostname");
            JSONObject div = c.optJSONObject("divergences");

            // Une divergence documentee verrouille le comportement REEL : la
            // corriger changerait le mot de passe des utilisateurs concernes,
            // ce qui se fera au lot 1 avec le carnet et un siteKey fige.
            String want = (div != null && div.has(IMPL))
                    ? div.getString(IMPL)
                    : c.getString("expected");

            String got = DomainNormalizer.normalize(hostname);
            if (!want.equals(got)) {
                problems.add(String.format("%n  %s : attendu %s, obtenu %s",
                        hostname, want, got));
            }
        }

        assertEquals("Ecart avec le referentiel partage :" + problems, 0, problems.size());
    }
}
