package fr.juliette.thecode;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Conformite aux vecteurs partages (shared/test-vectors.json).
 *
 * Garde-fou garantissant que les 6 implementations de TheCode produisent
 * exactement le meme mot de passe. Une divergence d'un caractere = un
 * utilisateur qui perd l'acces a ses comptes.
 *
 * La section v1 est FIGEE : ces valeurs sont en production. Si un test echoue
 * ici, ce n'est jamais le vecteur qu'il faut corriger.
 *
 * Le fichier lu est une copie synchronisee depuis shared/ (scripts/sync-shared.sh) ;
 * ne jamais l'editer directement.
 */
public class CodeConformanceTest {

    private static JSONObject loadVectors() throws Exception {
        try (InputStream in = CodeConformanceTest.class
                .getClassLoader().getResourceAsStream("test-vectors.json")) {
            assertTrue("test-vectors.json absent du classpath de test "
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
    public void vectorsAreLoadedAndFrozen() throws Exception {
        JSONObject root = loadVectors();
        assertEquals(1, root.getInt("schema"));
        assertEquals("frozen", root.getJSONObject("v1").getString("status"));
        assertTrue(root.getJSONObject("v1").getJSONArray("cases").length() > 0);
    }

    @Test
    public void alphabetsMatchSharedSpec() throws Exception {
        JSONObject alphabets = loadVectors().getJSONObject("v1").getJSONObject("alphabets");
        Code code = new Code();
        code.setMinState(true);
        code.setMajState(true);
        code.setSymState(true);
        code.setChiState(true);
        // buildCharset est privee : on verifie indirectement que chaque alphabet
        // partage est bien celui utilise, via les vecteurs mono-groupe.
        assertEquals("portezcviuxwhskyajgblndqfm", alphabets.getString("lower"));
        assertEquals("THEQUICKBROWNFXJMPSVLAZYDG", alphabets.getString("upper"));
        assertEquals("@#&!)-%;<:*$+=/?>(", alphabets.getString("symbols"));
        assertEquals("567438921", alphabets.getString("numbers"));
    }

    @Test
    public void everyV1VectorMatches() throws Exception {
        JSONArray cases = loadVectors().getJSONObject("v1").getJSONArray("cases");
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

            // Attention a l'ordre des arguments : getCode(clef, site), inverse
            // des autres implementations, alors que le hash porte sur site+clef.
            String got = code.getCode(c.getString("master"), c.getString("site"));
            String want = c.getString("expected");

            if (!want.equals(got)) {
                failures.append(String.format(
                        "%n  %s : attendu %s, obtenu %s", c.getString("id"), want, got));
            }
        }

        assertEquals("Divergence avec les vecteurs partages :" + failures, 0, failures.length());
    }
}
