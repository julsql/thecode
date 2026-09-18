package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Ce que le carnet apporte au remplissage automatique.
 *
 * Sans lui, le remplissage prenait le domaine tel quel avec les réglages
 * généraux : les trois problèmes d'usage d'origine restaient entiers dans ce
 * chemin-là.
 */
public class SiteResolutionTest {

    private static Vault vaultWith(VaultEntry... entries) {
        Vault vault = new Vault();
        vault.entries.addAll(Arrays.asList(entries));
        return vault;
    }

    @Test
    public void fallsBackToTheGeneralSettingsForAnUnknownSite() {
        // Comportement d'avant le carnet, qui doit rester identique.
        List<SiteResolution> out = SiteResolution.forDomain(
                new Vault(), "inconnu.fr", 24, true, true, false, true);

        assertEquals(1, out.size());
        assertEquals("inconnu.fr", out.get(0).siteKey);
        assertEquals("", out.get(0).entryId);
        assertEquals(24, out.get(0).length);
        assertEquals(1, out.get(0).v);
    }

    @Test
    public void usesTheSettingsRecordedForTheSite() {
        // Le deuxième problème : ne plus avoir à se souvenir qu'un site
        // n'accepte pas les symboles.
        VaultEntry entry = VaultEntry.create("banque.fr", null);
        entry.length = 12;
        entry.symbols = false;

        List<SiteResolution> out = SiteResolution.forDomain(
                vaultWith(entry), "banque.fr", 20, true, true, true, true);

        assertEquals(12, out.get(0).length);
        assertEquals(false, out.get(0).symbols);
    }

    @Test
    public void followsAnAliasToTheSameSiteKey() {
        // Le troisième problème : google.fr doit rendre le mot de passe de
        // google.com, pas un autre.
        VaultEntry entry = VaultEntry.create("google.com",
                Arrays.asList("google.com", "google.fr"));

        List<SiteResolution> out = SiteResolution.forDomain(
                vaultWith(entry), "google.fr", 20, true, true, true, true);

        assertEquals(1, out.size());
        assertEquals("google.com", out.get(0).siteKey);
    }

    @Test
    public void proposesEveryAccountOnTheSameSite() {
        // Le premier problème : deux comptes sur un site. On les propose tous
        // plutôt que d'en choisir un au hasard.
        VaultEntry perso = VaultEntry.create("google.com", null);
        perso.login = "moi@example.fr";
        VaultEntry pro = VaultEntry.create("google.com#pro", Collections.singletonList("google.com"));
        pro.login = "pro@example.fr";

        List<SiteResolution> out = SiteResolution.forDomain(
                vaultWith(perso, pro), "google.com", 20, true, true, true, true);

        assertEquals(2, out.size());
        assertTrue(out.get(0).label, out.get(0).label.contains("moi@example.fr"));
        assertTrue(out.get(1).label, out.get(1).label.contains("pro@example.fr"));
        // Des siteKey distincts : sinon les deux comptes auraient le même
        // mot de passe, ce qui était le problème de départ.
        assertTrue(!out.get(0).siteKey.equals(out.get(1).siteKey));
    }

    @Test
    public void ignoresADeletedEntry() {
        VaultEntry entry = VaultEntry.create("google.com", null);
        entry.deleted = true;

        List<SiteResolution> out = SiteResolution.forDomain(
                vaultWith(entry), "google.com", 20, true, true, true, true);

        // Une pierre tombale ne doit pas continuer à proposer un compte effacé.
        assertEquals("", out.get(0).entryId);
    }

    @Test
    public void findsTheChosenEntryAgainById() {
        VaultEntry entry = VaultEntry.create("google.com", null);
        entry.length = 32;

        SiteResolution found = SiteResolution.byId(vaultWith(entry), entry.id, "google.com",
                20, true, true, true, true);

        assertEquals(32, found.length);
    }

    @Test
    public void fallsBackWhenTheEntryVanishedInBetween() {
        // Une synchronisation a pu passer entre la suggestion et la validation.
        SiteResolution found = SiteResolution.byId(new Vault(), "un-id-disparu", "google.com",
                20, true, true, true, true);

        assertEquals("google.com", found.siteKey);
        assertEquals("", found.entryId);
    }
}
