package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Collections;
import java.util.List;

public class SyncTest {

    private static final Sync.Credentials CREDS =
            new Sync.Credentials("https://example.test/api", "access-1", "refresh-0");

    private static Vault vaultWith(String siteKey, String login) {
        Vault vault = new Vault();
        VaultEntry entry = VaultEntry.create(siteKey, Collections.singletonList(siteKey));
        entry.login = login;
        vault.entries.add(entry);
        return vault;
    }

    @Test
    public void sendsNothingReadableOverTheNetwork() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        new Sync(server).sync(vaultWith("banque-secrete.fr", "juliette"), "clef", CREDS);

        assertFalse(server.sentBodies.isEmpty());
        for (String body : server.sentBodies) {
            // Le serveur ne doit rien apprendre : ni le site, ni l'identifiant.
            assertFalse(body, body.contains("banque-secrete"));
            assertFalse(body, body.contains("juliette"));
        }
    }

    @Test
    public void twoDevicesConverge() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        Sync sync = new Sync(server);

        Vault phone = sync.sync(vaultWith("google.com", "moi@example.fr"), "clef", CREDS).vault;
        Vault laptop = sync.sync(vaultWith("github.com", "julsql"), "clef", CREDS).vault;
        // Le téléphone resynchronise : il doit récupérer l'entrée de l'ordinateur.
        phone = sync.sync(phone, "clef", CREDS).vault;

        assertEquals(2, laptop.entries.size());
        assertEquals(2, phone.entries.size());
        assertNotNull(phone.findByDomain("github.com"));
        assertNotNull(laptop.findByDomain("google.com"));
    }

    @Test
    public void propagatesTombstones() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        Sync sync = new Sync(server);

        Vault phone = sync.sync(vaultWith("google.com", "moi"), "clef", CREDS).vault;
        phone.entries.get(0).deleted = true;
        phone.entries.get(0).updatedAt = "2999-01-01T00:00:00Z";
        sync.sync(phone, "clef", CREDS);

        // Une suppression doit se propager : sans pierre tombale, la fusion
        // suivante ressusciterait l'entrée depuis l'autre appareil.
        Vault laptop = sync.sync(vaultWith("google.com", "moi"), "clef", CREDS).vault;
        assertTrue(laptop.entries.get(0).deleted);
    }

    @Test
    public void refusesToOpenWithAnotherMasterKey() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        Sync sync = new Sync(server);
        sync.sync(vaultWith("google.com", "moi"), "clef", CREDS);

        try {
            sync.sync(new Vault(), "mauvaise-clef", CREDS);
            throw new AssertionError("un carnet chiffré avec une autre clef a été ouvert");
        } catch (Sync.SyncException e) {
            // Message explicite : sinon l'utilisatrice croirait à une panne.
            assertTrue(e.getMessage(), e.getMessage().contains("clef maîtresse"));
        }
    }

    @Test
    public void renewsAnExpiredAccessToken() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        server.validAccessToken = "expiré";

        Sync.Result result =
                new Sync(server).syncRenewing(vaultWith("google.com", "moi"), "clef", CREDS);

        assertEquals(1, server.refreshCount);
        assertEquals("access-2", result.credentials.accessToken);
        assertEquals(1, server.revision);
    }

    @Test
    public void reportsAStaleRevisionInsteadOfOverwriting() {
        StringBuilder pushed = new StringBuilder();
        Sync sync = new Sync((url, method, body, bearer) -> {
            if ("GET".equals(method)) {
                return new Sync.Response(200, "{\"revision\":3,\"entries\":[]}");
            }
            pushed.append(body);
            // Un autre appareil a écrit entre le pull et le push.
            return new Sync.Response(409,
                    "{\"detail\":\"Le carnet a changé depuis (révision 4)\"}");
        });

        try {
            sync.sync(new Vault(), "clef", CREDS);
            throw new AssertionError("un push sur une révision périmée a été accepté");
        } catch (Sync.SyncException e) {
            // Refuser vaut mieux qu'écraser : la fusion doit être refaite.
            assertEquals(409, e.status);
            assertTrue(pushed.toString(), pushed.toString().contains("\"base_revision\":3"));
        }
    }

    @Test
    public void surfacesServerErrors() {
        Sync sync = new Sync((url, method, body, bearer) ->
                new Sync.Response(500, "{\"detail\":\"base indisponible\"}"));

        try {
            sync.sync(new Vault(), "clef", CREDS);
            throw new AssertionError("une erreur serveur a été avalée");
        } catch (Sync.SyncException e) {
            assertEquals(500, e.status);
            assertTrue(e.getMessage(), e.getMessage().contains("base indisponible"));
        }
    }

    @Test
    public void reportsAnUnreachableService() {
        Sync sync = new Sync((url, method, body, bearer) -> {
            throw new java.io.IOException("DNS introuvable");
        });

        try {
            sync.sync(new Vault(), "clef", CREDS);
            throw new AssertionError("une panne réseau a été avalée");
        } catch (Sync.SyncException e) {
            assertTrue(e.getMessage(), e.getMessage().contains("injoignable"));
        }
    }

    @Test
    public void reportsAMergeConflictInsteadOfChoosingSilently() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        Sync sync = new Sync(server);

        Vault phone = vaultWith("google.com", "moi");
        sync.sync(phone, "clef", CREDS);

        // Même entrée, mais le siteKey a divergé : il produit le mot de passe,
        // trancher en silence changerait celui-ci sans prévenir.
        Vault laptop = new Vault();
        VaultEntry other = VaultEntry.create("google.fr", Collections.singletonList("google.fr"));
        other.id = phone.entries.get(0).id;
        laptop.entries.add(other);

        List<Vault.Conflict> conflicts = sync.sync(laptop, "clef", CREDS).conflicts;
        assertEquals(1, conflicts.size());
        assertEquals("sitekey-divergent", conflicts.get(0).kind);
    }
}
