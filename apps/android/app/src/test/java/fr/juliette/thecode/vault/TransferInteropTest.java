package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.zip.InflaterInputStream;

import javax.crypto.SecretKey;

/**
 * Interoperabilite du transfert.
 *
 * Un carnet chiffre sur un appareil doit etre lisible sur tous les autres.
 * Sans ce vecteur partage, deux plateformes pourraient diverger sur le sel, la
 * compression ou l'encodage sans que rien ne le signale.
 *
 * Fichier synchronise depuis shared/ ; ne jamais l'editer directement.
 */
public class TransferInteropTest {

    private static JSONObject loadVector() throws Exception {
        try (InputStream in = TransferInteropTest.class.getClassLoader()
                .getResourceAsStream("transfer-vector.json")) {
            assertTrue("transfer-vector.json absent (lancer: make sync-shared)", in != null);
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) buf.write(chunk, 0, n);
            return new JSONObject(new String(buf.toByteArray(), StandardCharsets.UTF_8));
        }
    }

    private static byte[] b64d(String value) {
        return Base64.getUrlDecoder().decode(
                value + "=".repeat((4 - value.length() % 4) % 4));
    }

    @Test
    public void decryptsAPayloadFromAnotherImplementation() throws Exception {
        JSONObject vector = loadVector();
        String[] parts = vector.getString("payload").split("\\.");
        assertEquals("TC1", parts[0]);

        SecretKey key = Transfer.deriveKey(vector.getString("masterKey"));
        // openBytes et non open : le contenu est compressé, donc binaire.
        byte[] compressed = Transfer.openBytes(key, b64d(parts[1]), b64d(parts[2]));

        // Le payload partage est compresse : on decompresse pour retrouver le
        // carnet d'origine.
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (InflaterInputStream inflater = new InflaterInputStream(
                new java.io.ByteArrayInputStream(compressed))) {
            byte[] chunk = new byte[8192];
            int n;
            while ((n = inflater.read(chunk)) != -1) out.write(chunk, 0, n);
        }

        JSONObject vault = new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8));
        assertEquals(1, vault.getInt("schema"));
        assertEquals("google.com",
                vault.getJSONArray("entries").getJSONObject(0).getString("siteKey"));
    }
}
