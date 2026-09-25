package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

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
        new Sync(server).sync(vaultWith("banque-secrete.fr", "utilisateur"), "clef", CREDS);

        assertFalse(server.sentBodies.isEmpty());
        for (String body : server.sentBodies) {
            // Le serveur ne doit rien apprendre : ni le site, ni l'identifiant.
            assertFalse(body, body.contains("banque-secrete"));
            assertFalse(body, body.contains("utilisateur"));
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
    public void pushesOnlyTheOldestBeyondTheLimit() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        server.maxEntries = 2;
        Vault vault = new Vault();
        String[][] sites = {
                {"recent.fr", "2026-03-01T00:00:00Z"},
                {"ancien.fr", "2026-01-01T00:00:00Z"},
                {"moyen.fr", "2026-02-01T00:00:00Z"},
        };
        for (String[] site : sites) {
            VaultEntry entry = VaultEntry.create(site[0], null);
            entry.createdAt = site[1];
            vault.entries.add(entry);
        }

        Sync.Result result = new Sync(server).sync(vault, "clef", CREDS);

        JSONArray rows = new JSONObject(server.sentBodies.get(0)).getJSONArray("entries");
        Set<String> pushed = new HashSet<>();
        for (int i = 0; i < rows.length(); i++) {
            pushed.add(rows.getJSONObject(i).getString("entry_id"));
        }
        assertEquals(Set.of(vault.findByDomain("ancien.fr").id,
                vault.findByDomain("moyen.fr").id), pushed);
        // L'entrée en trop reste dans le carnet local.
        assertEquals(1, result.localOnly);
        assertEquals(3, result.vault.entries.size());
    }

    @Test
    public void pushesEverythingWithoutAnAdvertisedLimit() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        Vault vault = vaultWith("a.fr", null);
        vault.entries.add(VaultEntry.create("b.fr", null));

        Sync.Result result = new Sync(server).sync(vault, "clef", CREDS);

        assertEquals(2, new JSONObject(server.sentBodies.get(0)).getJSONArray("entries").length());
        assertEquals(0, result.localOnly);
    }

    @Test
    public void propagatesTombstones() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        Sync sync = new Sync(server);

        Vault phone = sync.sync(vaultWith("google.com", "moi"), "clef", CREDS).vault;
        String deletedId = phone.entries.get(0).id;
        phone.entries.get(0).deleted = true;
        phone.entries.get(0).updatedAt = "2999-01-01T00:00:00Z";
        sync.sync(phone, "clef", CREDS);

        // Une suppression doit se propager : sans pierre tombale, la fusion
        // suivante ressusciterait l'entrée depuis l'autre appareil.
        //
        // La recherche se fait par identifiant : merge trie par id, et
        // l'ordinateur apporte sa propre entrée, d'identifiant aléatoire.
        Vault laptop = sync.sync(vaultWith("google.com", "moi"), "clef", CREDS).vault;
        VaultEntry propagated = null;
        for (VaultEntry entry : laptop.entries) {
            if (entry.id.equals(deletedId)) propagated = entry;
        }
        assertNotNull(propagated);
        assertTrue(propagated.deleted);
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
