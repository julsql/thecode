package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotSame;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;

import org.junit.Test;

import java.util.Arrays;

/**
 * Enregistrer un compte : domaine et identifiant désignent l'entrée.
 *
 * L'identifiant entre dans la dérivation v2 : deux identifiants sur un même
 * site sont deux mots de passe, donc deux entrées.
 */
public class VaultAccountTest {

    @Test
    public void createsAV2EntryWithTheLogin() {
        Vault vault = new Vault();
        VaultEntry entry = vault.upsertAccount("github.com", "julsql", 24,
                true, true, false, true);

        assertEquals(1, vault.entries.size());
        assertEquals("github.com", entry.siteKey);
        assertEquals("julsql", entry.login);
        assertEquals(2, entry.v);
        assertEquals(24, entry.length);
    }

    @Test
    public void anEmptyLoginIsStoredAsAbsent() {
        // Absent et vide dérivent pareil ; absent garde le JSON identique à
        // celui des entrées sans identifiant.
        VaultEntry entry = new Vault().upsertAccount("github.com", "", 20,
                true, true, true, true);
        assertNull(entry.login);
    }

    @Test
    public void updatesTheSameAccountWithoutTouchingTheSiteKey() {
        Vault vault = new Vault();
        VaultEntry existing = VaultEntry.create("google.com",
                Arrays.asList("google.com", "google.fr"));
        existing.login = "moi";
        vault.entries.add(existing);

        VaultEntry updated = vault.upsertAccount("google.fr", "moi", 32,
                true, false, false, true);

        assertSame(existing, updated);
        assertEquals(1, vault.entries.size());
        assertEquals("google.com", updated.siteKey);
        assertEquals(32, updated.length);
    }

    @Test
    public void anotherLoginIsAnotherEntry() {
        Vault vault = new Vault();
        VaultEntry first = vault.upsertAccount("github.com", "perso", 20,
                true, true, true, true);
        VaultEntry second = vault.upsertAccount("github.com", "pro", 20,
                true, true, true, true);

        assertNotSame(first, second);
        assertEquals(2, vault.entries.size());
    }

    @Test
    public void anEmptyLoginMatchesAnEntryWithoutLogin() {
        Vault vault = new Vault();
        VaultEntry existing = vault.upsert("github.com", 20, true, true, true, true);

        assertSame(existing, vault.upsertAccount("github.com", "", 28,
                true, true, true, true));
        assertSame(existing, vault.findAccount("github.com", null));
        assertNull(vault.findAccount("github.com", "quelqu-un"));
    }

    @Test
    public void ignoresDeletedEntries() {
        Vault vault = new Vault();
        VaultEntry gone = vault.upsertAccount("github.com", "moi", 20,
                true, true, true, true);
        gone.deleted = true;

        VaultEntry fresh = vault.upsertAccount("github.com", "moi", 20,
                true, true, true, true);

        assertNotSame(gone, fresh);
    }
}
