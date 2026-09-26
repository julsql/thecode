package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.InflaterInputStream;

import javax.crypto.SecretKey;

/**
 * Interoperabilite du transfert v2.
 *
 * Un carnet chiffre sur un appareil doit etre lisible sur tous les autres.
 * Sans ce vecteur partage, deux plateformes pourraient diverger sur le sel, la
 * compression ou l'encodage sans que rien ne le signale.
 *
 * Fichier synchronise depuis shared/ ; ne jamais l'editer directement.
 */
public class TransferInteropTest {

    static JSONObject loadVector() throws Exception {
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

    /** Égalité JSON, ordre des clefs ignoré (similar() manque au JSONObject d'Android). */
    static boolean sameJson(Object a, Object b) throws Exception {
        if (a instanceof JSONObject && b instanceof JSONObject) {
            JSONObject x = (JSONObject) a;
            JSONObject y = (JSONObject) b;
            if (x.length() != y.length()) return false;
            java.util.Iterator<String> keys = x.keys();
            while (keys.hasNext()) {
                String k = keys.next();
                if (!y.has(k) || !sameJson(x.get(k), y.get(k))) return false;
            }
            return true;
        }
        if (a instanceof JSONArray && b instanceof JSONArray) {
            JSONArray x = (JSONArray) a;
            JSONArray y = (JSONArray) b;
            if (x.length() != y.length()) return false;
            for (int i = 0; i < x.length(); i++) {
                if (!sameJson(x.get(i), y.get(i))) return false;
            }
            return true;
        }
        if (a instanceof Number && b instanceof Number) {
            return ((Number) a).doubleValue() == ((Number) b).doubleValue();
        }
        return a.equals(b);
    }

    private static String hex(byte[] raw) {
        StringBuilder out = new StringBuilder();
        for (byte b : raw) out.append(String.format("%02x", b));
        return out.toString();
    }

    @Test
    public void derivesTheSameTransferKey() throws Exception {
        JSONObject vector = loadVector();
        String[] parts = vector.getString("payload").split("\\.");
        assertEquals("TC2", parts[0]);

        SecretKey key = Transfer.deriveTransferKey(vector.getString("masterKey"),
                Base64Url.decode(parts[1]));
        assertEquals(vector.getString("derivedTransferHex"), hex(key.getEncoded()));
        assertEquals(vector.getString("aad"),
                new String(Transfer.TRANSFER_AAD, StandardCharsets.UTF_8));
    }

    @Test
    public void decryptsAPayloadFromAnotherImplementation() throws Exception {
        JSONObject vector = loadVector();
        String[] parts = vector.getString("payload").split("\\.");

        SecretKey key = Transfer.deriveTransferKey(vector.getString("masterKey"),
                Base64Url.decode(parts[1]));
        // openBytes et non open : le contenu est compressé, donc binaire.
        byte[] compressed = Transfer.openBytes(key, Base64Url.decode(parts[2]),
                Base64Url.decode(parts[3]), Transfer.TRANSFER_AAD);

        // zlib (en-tete compris) : InflaterInputStream le lit tel quel.
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (InflaterInputStream inflater = new InflaterInputStream(
                new java.io.ByteArrayInputStream(compressed))) {
            byte[] chunk = new byte[8192];
            int n;
            while ((n = inflater.read(chunk)) != -1) out.write(chunk, 0, n);
        }

        JSONObject vault = new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8));
        assertTrue(vault.toString(), sameJson(vector.getJSONObject("vault"), vault));
    }

    @Test
    public void refusesEveryRejectedPayload() throws Exception {
        JSONObject vector = loadVector();
        JSONArray rejected = vector.getJSONArray("rejected");
        assertTrue(rejected.length() > 0);

        for (int i = 0; i < rejected.length(); i++) {
            JSONObject c = rejected.getJSONObject(i);
            assertThrows(c.getString("name") + " : " + c.getString("why"),
                    Transfer.TransferException.class,
                    () -> Transfer.importVault(c.getString("payload"),
                            vector.getString("masterKey")));
        }
    }
}
