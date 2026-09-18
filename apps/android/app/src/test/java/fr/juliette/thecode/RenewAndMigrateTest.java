package fr.juliette.thecode;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;

import org.junit.Test;

import fr.juliette.thecode.vault.SiteResolution;
import fr.juliette.thecode.vault.VaultEntry;

/**
 * Renouveler et migrer : les deux actions qui changent un mot de passe déjà en
 * service.
 *
 * Ce qui compte est qu'on puisse calculer le nouveau <b>avant</b> d'écrire quoi
 * que ce soit : écrire d'abord rendrait le compte inaccessible, l'ancien mot de
 * passe étant encore celui du site.
 */
public class RenewAndMigrateTest {

    private static String passwordFor(VaultEntry entry) {
        return Generator.generate(SiteResolution.of(entry), "clef", null);
    }

    @Test
    public void renewingChangesThePasswordOfAV2Entry() {
        VaultEntry entry = VaultEntry.create("google.com", null);
        entry.v = 2;

        VaultEntry preview = VaultEntry.copyOf(entry);
        preview.counter = entry.counter + 1;

        assertNotEquals(passwordFor(entry), passwordFor(preview));
    }

    @Test
    public void previewingDoesNotTouchTheEntry() {
        // Modifier l'entrée puis revenir en arrière laisserait la porte ouverte
        // à un carnet enregistré à mi-chemin.
        VaultEntry entry = VaultEntry.create("google.com", null);
        entry.v = 2;

        VaultEntry preview = VaultEntry.copyOf(entry);
        preview.counter = 99;
        preview.v = 1;

        assertEquals(1, entry.counter);
        assertEquals(2, entry.v);
    }

    @Test
    public void migratingChangesThePassword() {
        // C'est pourquoi la migration s'affiche avec les deux mots de passe :
        // il faudra aller changer celui du site.
        VaultEntry entry = VaultEntry.create("google.com", null);

        VaultEntry migrated = VaultEntry.copyOf(entry);
        migrated.v = 2;

        assertNotEquals(passwordFor(entry), passwordFor(migrated));
    }

    @Test
    public void theCounterDoesNothingInV1() {
        // D'où le refus de renouveler une entrée v1 : l'incrémenter ne
        // changerait rien, et le laisser croire serait pire.
        VaultEntry entry = VaultEntry.create("google.com", null);

        VaultEntry bumped = VaultEntry.copyOf(entry);
        bumped.counter = 5;

        assertEquals(passwordFor(entry), passwordFor(bumped));
    }

    @Test
    public void aCopyKeepsEverythingThatMatters() {
        VaultEntry entry = VaultEntry.create("google.com", java.util.Arrays.asList(
                "google.com", "google.fr"));
        entry.login = "moi@example.fr";
        entry.length = 32;
        entry.symbols = false;
        entry.v = 2;
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
