package fr.juliette.thecode;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;

import org.junit.Test;

import fr.juliette.thecode.vault.SiteResolution;
import fr.juliette.thecode.vault.VaultEntry;

/**
 * Renouveler : la seule action qui change un mot de passe déjà en service.
 *
 * Ce qui compte est qu'on puisse calculer le nouveau <b>avant</b> d'écrire quoi
 * que ce soit : écrire d'abord rendrait le compte inaccessible, l'ancien mot de
 * passe étant encore celui du site.
 */
public class RenewTest {

    private static String passwordFor(VaultEntry entry) {
        return Generator.generate(SiteResolution.of(entry), "clef", null);
    }

    @Test
    public void entriesAreBornInV2() {
        assertEquals(2, VaultEntry.create("google.com", null).v);
    }

    @Test
    public void renewingChangesThePassword() {
        VaultEntry entry = VaultEntry.create("google.com", null);

        VaultEntry preview = VaultEntry.copyOf(entry);
        preview.counter = entry.counter + 1;

        assertNotEquals(passwordFor(entry), passwordFor(preview));
    }

    @Test
    public void previewingDoesNotTouchTheEntry() {
        // Modifier l'entrée puis revenir en arrière laisserait la porte ouverte
        // à un carnet enregistré à mi-chemin.
        VaultEntry entry = VaultEntry.create("google.com", null);

        VaultEntry preview = VaultEntry.copyOf(entry);
        preview.counter = 99;

        assertEquals(1, entry.counter);
        assertEquals(2, entry.v);
    }

    @Test
    public void aCopyKeepsEverythingThatMatters() {
        VaultEntry entry = VaultEntry.create("google.com", java.util.Arrays.asList(
                "google.com", "google.fr"));
        entry.login = "moi@example.fr";
        entry.length = 32;
        entry.symbols = false;
        entry.counter = 3;

        VaultEntry copy = VaultEntry.copyOf(entry);

        assertEquals(entry.id, copy.id);
        assertEquals(entry.siteKey, copy.siteKey);
        assertEquals(entry.login, copy.login);
        assertEquals(entry.domains, copy.domains);
        assertEquals(entry.length, copy.length);
        assertEquals(entry.symbols, copy.symbols);
        assertEquals(entry.v, copy.v);
        assertEquals(entry.counter, copy.counter);

        // Listes distinctes : sinon modifier la copie modifierait l'original.
        copy.domains.add("ajout.fr");
        assertEquals(2, entry.domains.size());
    }
}
