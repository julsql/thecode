package fr.juliette.thecode;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Conformité de l'algorithme v2, contre les vecteurs partagés.
 *
 * Une divergence ici ne se verrait qu'à l'usage : le téléphone rendrait un
 * autre mot de passe que l'ordinateur pour la même entrée du carnet.
 *
 * Spécification : shared/spec/algo-v2.md
 */
public class CodeV2ConformanceTest {

    private static JSONArray cases() throws Exception {
        try (InputStream in = CodeV2ConformanceTest.class.getClassLoader()
                .getResourceAsStream("test-vectors.json")) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) buf.write(chunk, 0, n);
            return new JSONObject(new String(buf.toByteArray(), StandardCharsets.UTF_8))
                    .getJSONObject("v2").getJSONArray("cases");
        }
    }

    @Test
    public void matchesEveryVector() throws Exception {
        JSONArray cases = cases();
        StringBuilder failures = new StringBuilder();

        for (int i = 0; i < cases.length(); i++) {
            JSONObject c = cases.getJSONObject(i);
            JSONObject charset = c.getJSONObject("charset");

            Code code = new Code();
            code.setLength(c.getInt("length"));
            code.setMinState(charset.getBoolean("lower"));
            code.setMajState(charset.getBoolean("upper"));
            code.setSymState(charset.getBoolean("symbols"));
            code.setChiState(charset.getBoolean("numbers"));

            String got = CodeV2.getCode(code, c.getString("master"), c.getString("site"),
                    c.getString("login"), c.getInt("counter"), null);
            String want = c.getString("expected");

            if (!want.equals(got)) {
                failures.append(String.format(
                        "%n  %s : attendu %s, obtenu %s", c.getString("id"), want, got));
            }
        }

        assertEquals("vecteurs v2 en echec :" + failures, 0, failures.length());
    }

    @Test
    public void separatesFieldsSoConcatenationCannotCollide() throws Exception {
        // En v1, ("google.com", "abc") et ("google.co", "mabc") donnaient le
        // meme mot de passe. C'est ce que l'octet nul corrige.
        Code code = new Code();
        byte[] master = CodeV2.deriveMasterKey("clef");

        assertNotEquals(
                CodeV2.getCode(code, "clef", "google.com", "abc", 1, master),
                CodeV2.getCode(code, "clef", "google.co", "mabc", 1, master));
    }

    @Test
    public void theCounterChangesThePassword() throws Exception {
        // Sans compteur, rien ne permet de renouveler un mot de passe sans
        // changer la clef maitresse.
        Code code = new Code();
        byte[] master = CodeV2.deriveMasterKey("clef");

        assertNotEquals(
                CodeV2.getCode(code, "clef", "google.com", "", 1, master),
                CodeV2.getCode(code, "clef", "google.com", "", 2, master));
    }

    @Test
    public void theLoginChangesThePassword() throws Exception {
        // Deux comptes sur un meme site : c'est le probleme d'origine.
        Code code = new Code();
        byte[] master = CodeV2.deriveMasterKey("clef");

        assertNotEquals(
                CodeV2.getCode(code, "clef", "google.com", "moi@example.fr", 1, master),
                CodeV2.getCode(code, "clef", "google.com", "autre@example.fr", 1, master));
    }

    @Test
    public void aDerivedMasterKeyGivesTheSameResult() throws Exception {
        // La derivation coute volontairement cher : on doit pouvoir la
        // reutiliser d'un site a l'autre sans changer le resultat.
        Code code = new Code();
        byte[] master = CodeV2.deriveMasterKey("clef");

        assertEquals(
                CodeV2.getCode(code, "clef", "google.com", "", 1, null),
                CodeV2.getCode(code, "clef", "google.com", "", 1, master));
    }
}
