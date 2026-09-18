package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Arrays;

/**
 * Enregistrer les réglages d'un site.
 *
 * Le piège est le siteKey : il produit le mot de passe, le réécrire changerait
 * un mot de passe déjà en service.
 */
public class VaultUpsertTest {

    @Test
    public void createsAnEntryForANewSite() {
        Vault vault = new Vault();
        VaultEntry entry = vault.upsert("google.com", 24, true, true, false, true);

        assertEquals(1, vault.entries.size());
        assertEquals("google.com", entry.siteKey);
        assertEquals(24, entry.length);
        assertFalse(entry.symbols);
    }

    @Test
    public void updatesSettingsWithoutTouchingTheSiteKey() {
        Vault vault = new Vault();
        VaultEntry created = vault.upsert("google.com", 20, true, true, true, true);
        String siteKey = created.siteKey;

        VaultEntry updated = vault.upsert("google.com", 32, true, false, false, true);

        assertEquals(1, vault.entries.size());
        assertEquals(siteKey, updated.siteKey);
        assertEquals(32, updated.length);
        assertFalse(updated.upper);
    }

    @Test
    public void findsAnEntryByAnyOfItsDomains() {
        // Sans cela « google.fr » créerait un doublon d'une entrée qui le
        // couvre déjà, avec un mot de passe différent.
        Vault vault = new Vault();
        VaultEntry entry = VaultEntry.create("google.com",
                Arrays.asList("google.com", "google.fr"));
        vault.entries.add(entry);

        VaultEntry found = vault.upsert("google.fr", 28, true, true, true, true);

        assertEquals(1, vault.entries.size());
        assertEquals("google.com", found.siteKey);
        assertEquals(28, found.length);
    }

    @Test
    public void reportsWhenTheSiteKeyDiffersFromWhatWasTyped() {
        Vault vault = new Vault();
        vault.entries.add(VaultEntry.create("google.com",
                Arrays.asList("google.com", "google.fr")));

        // L'appelant s'en sert pour prévenir : le mot de passe affiché vient de
        // « google.fr », celui de l'entrée viendra de « google.com ».
        assertNotEquals("google.fr", vault.upsert("google.fr", 20, true, true, true, true).siteKey);
    }

    @Test
    public void startsAfreshAfterADeletion() {
        Vault vault = new Vault();
        VaultEntry entry = vault.upsert("google.com", 20, true, true, true, true);
        entry.deleted = true;

        // Une entrée supprimée n'est pas ressuscitée : sa pierre tombale doit
        // se propager. On en crée une nouvelle, avec son propre identifiant.
        VaultEntry again = vault.upsert("google.com", 20, true, true, true, true);
        assertFalse(again.deleted);
        assertNotEquals(entry.id, again.id);
        assertEquals(2, vault.entries.size());
    }

    @Test
    public void stampsTheEntry() throws Exception {
        Vault vault = new Vault();
        VaultEntry entry = vault.upsert("google.com", 20, true, true, true, true);
        String first = entry.updatedAt;

        Thread.sleep(1100);
        vault.upsert("google.com", 24, true, true, true, true);

        // L'horodatage départage les carnets à la fusion : sans mise à jour,
        // l'autre appareil gagnerait et les réglages seraient perdus.
        assertTrue(vault.entries.get(0).updatedAt.compareTo(first) > 0);
    }
}
