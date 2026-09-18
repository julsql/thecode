package fr.juliette.thecode;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;

import org.junit.Test;

import fr.juliette.thecode.vault.SiteResolution;

/**
 * Le point de passage entre le carnet et les deux versions de l'algorithme.
 *
 * Appliquer la mauvaise version rendrait un mot de passe faux sans rien
 * signaler — le pire des échecs pour ce produit.
 */
public class GeneratorTest {

    @Test
    public void anUnknownSiteKeepsTheV1Password() {
        // Le repli reproduit le comportement d'avant le carnet, au caractère
        // près : un mot de passe déjà en service ne doit pas changer.
        Code code = new Code();
        code.setLength(20);

        SiteResolution fallback = SiteResolution.fallback(
                "google.com", 20, true, true, true, true);

        assertEquals(code.getCode("clef", "google.com"),
                Generator.generate(fallback, "clef", null));
    }

    @Test
    public void aV2EntryDoesNotProduceTheV1Password() {
        SiteResolution v1 = SiteResolution.fallback("google.com", 20, true, true, true, true);
        String v1Password = Generator.generate(v1, "clef", null);

        // Même site, même réglages, version différente : c'est justement ce que
        // l'application ne savait pas faire.
        fr.juliette.thecode.vault.VaultEntry entry =
                fr.juliette.thecode.vault.VaultEntry.create("google.com", null);
        entry.v = 2;
        fr.juliette.thecode.vault.Vault vault = new fr.juliette.thecode.vault.Vault();
        vault.entries.add(entry);

        String v2Password = Generator.generate(
                SiteResolution.byId(vault, entry.id, "google.com", 20, true, true, true, true),
                "clef", null);

        assertNotEquals(v1Password, v2Password);
        assertEquals(20, v2Password.length());
    }

    @Test
    public void theRecordedSettingsAreApplied() {
        fr.juliette.thecode.vault.VaultEntry entry =
                fr.juliette.thecode.vault.VaultEntry.create("banque.fr", null);
        entry.length = 12;
        entry.symbols = false;
        fr.juliette.thecode.vault.Vault vault = new fr.juliette.thecode.vault.Vault();
        vault.entries.add(entry);

        String password = Generator.generate(
                SiteResolution.byId(vault, entry.id, "banque.fr", 20, true, true, true, true),
                "clef", null);

        assertEquals(12, password.length());
        for (char c : password.toCharArray()) {
            assertEquals("symbole inattendu : " + c, true, Character.isLetterOrDigit(c));
        }
    }
}
