package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.ArrayList;

/** Suppression depuis l'écran carnet : une pierre tombale, pas un retrait. */
public class VaultDeleteTest {

    @Test
    public void deleteLeavesATombstoneStampedNow() {
        Vault vault = new Vault();
        VaultEntry entry = vault.upsert("google.com", 20, true, true, true, true);
        entry.updatedAt = "2020-01-01T00:00:00Z";

        assertTrue(vault.delete(entry.id, "2026-09-25T10:00:00Z"));

        assertEquals(1, vault.entries.size());
        assertTrue(entry.deleted);
        assertEquals("2026-09-25T10:00:00Z", entry.updatedAt);
        assertNull(vault.findByDomain("google.com"));
    }

    @Test
    public void deletingTwiceOrAnUnknownIdChangesNothing() {
        Vault vault = new Vault();
        VaultEntry entry = vault.upsert("google.com", 20, true, true, true, true);
        vault.delete(entry.id, "2026-09-25T10:00:00Z");

        assertFalse(vault.delete(entry.id, "2027-01-01T00:00:00Z"));
        assertEquals("2026-09-25T10:00:00Z", entry.updatedAt);
        assertFalse(vault.delete("unknown", "2027-01-01T00:00:00Z"));
    }

    @Test
    public void tombstoneSurvivesSerializationAndWinsTheMerge() throws Exception {
        Vault local = new Vault();
        VaultEntry entry = local.upsert("google.com", 20, true, true, true, true);
        entry.updatedAt = "2026-01-01T00:00:00Z";
        Vault remote = Vault.fromJson(local.toJson());

        local.delete(entry.id, "2026-09-25T10:00:00Z");
        Vault reloaded = Vault.fromJson(local.toJson());
        assertTrue(reloaded.entries.get(0).deleted);

        Vault merged = Vault.merge(remote, reloaded, new ArrayList<>());
        assertTrue(merged.entries.get(0).deleted);
        assertEquals("2026-09-25T10:00:00Z", merged.entries.get(0).updatedAt);
    }
}
