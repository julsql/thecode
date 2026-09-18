package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Export et import chiffres d'un carnet.
 *
 * L'essentiel est l'interoperabilite : un carnet exporte depuis un appareil
 * doit etre lisible par un autre, quelle que soit l'implementation.
 */
public class TransferVaultTest {

    private static Vault filled() {
        Vault vault = new Vault();
        VaultEntry entry = VaultEntry.create("google.com",
                Arrays.asList("google.com", "google.fr"));
        entry.login = "moi@example.com";
        vault.entries.add(entry);
        return vault;
    }

    @Test
    public void roundTripsFaithfully() throws Exception {
        Vault before = filled();
        Vault after = Transfer.importVault(Transfer.exportVault(before, "clef"), "clef");

        assertEquals(before.entries.size(), after.entries.size());
        assertEquals(before.entries.get(0).canonical(), after.entries.get(0).canonical());
        assertEquals(before.updatedAt, after.updatedAt);
    }

    @Test
    public void refusesAnotherMasterKey() throws Exception {
        String payload = Transfer.exportVault(filled(), "clef");

        // AES-GCM authentifie : il refuse, il ne rend pas un contenu faux.
        assertThrows(Transfer.TransferException.class,
                () -> Transfer.importVault(payload, "mauvaise"));
    }

    @Test
    public void refusesAnUnknownVersion() {
        // Interpreter un format inconnu au hasard serait pire que refuser.
        Transfer.TransferException e = assertThrows(Transfer.TransferException.class,
                () -> Transfer.importVault("TC9.aaa.bbb", "clef"));
        assertTrue(e.getMessage(), e.getMessage().contains("TC9"));
    }

    @Test
    public void refusesATruncatedPayload() {
        assertThrows(Transfer.TransferException.class,
                () -> Transfer.importVault("TC1.seulement-deux", "clef"));
    }

    @Test
    public void detectsTampering() throws Exception {
        String[] parts = Transfer.exportVault(filled(), "clef").split("\\.");
        String tampered = parts[0] + "." + parts[1] + "."
                + parts[2].substring(0, parts[2].length() - 1) + "A";

        assertThrows(Transfer.TransferException.class,
                () -> Transfer.importVault(tampered, "clef"));
    }

    @Test
    public void neverReusesANonce() throws Exception {
        // Reutiliser un nonce avec la meme clef casse AES-GCM.
        Vault vault = filled();
        Set<String> nonces = new HashSet<>();
        for (int i = 0; i < 10; i++) {
            nonces.add(Transfer.exportVault(vault, "clef").split("\\.")[1]);
        }
        assertEquals(10, nonces.size());
    }

    @Test
    public void producesWhatTheOthersRead() throws Exception {
        String payload = Transfer.exportVault(filled(), "clef");

        assertTrue(payload, payload.startsWith("TC1."));
        // base64url sans remplissage : un « + » ou un « = » casserait les autres.
        assertTrue(payload, payload.substring(4).matches("[A-Za-z0-9_.-]+"));
    }

    @Test
    public void readsAPayloadFromAnotherImplementation() throws Exception {
        // Le fichier vient du CLI Python : c'est la seule garantie qui vaille.
        try (InputStream in = TransferVaultTest.class.getClassLoader()
                .getResourceAsStream("transfer-vector.json")) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) buf.write(chunk, 0, n);
            JSONObject vector = new JSONObject(
                    new String(buf.toByteArray(), StandardCharsets.UTF_8));

            Vault imported = Transfer.importVault(
                    vector.getString("payload"), vector.getString("masterKey"));
            assertNotEquals(0, imported.entries.size());
        }
    }

    @Test
    public void compressionShrinksARepetitiveVault() throws Exception {
        // C'est ce qui fait tenir cinquante entrees dans un seul QR.
        Vault big = new Vault();
        for (int i = 0; i < 50; i++) {
            big.entries.add(VaultEntry.create("site" + i + ".example.com", null));
        }

        int raw = big.toCompactJson().getBytes(StandardCharsets.UTF_8).length;
        int compressed = Transfer.deflate(
                big.toCompactJson().getBytes(StandardCharsets.UTF_8)).length;

        assertTrue("brut " + raw + ", compresse " + compressed, compressed < raw / 2);
    }
}
