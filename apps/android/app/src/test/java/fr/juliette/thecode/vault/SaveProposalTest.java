package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class SaveProposalTest {

    /** Dérivation factice : assez pour distinguer les identifiants. */
    private static final SaveProposal.Deriver DERIVER = login -> "mdp[" + login + "]";

    @Test
    public void proposesForAnUnknownSiteWhenLinked() {
        assertTrue(SaveProposal.shouldPropose(true, new Vault(), "github.com"));
    }

    @Test
    public void staysQuietWhenNotLinked() {
        assertFalse(SaveProposal.shouldPropose(false, new Vault(), "github.com"));
    }

    @Test
    public void staysQuietForAKnownSite() {
        Vault vault = new Vault();
        vault.upsertAccount("github.com", "moi", 20, true, true, true, true);
        // Connu, quel que soit l'identifiant : c'est le site qui compte.
        assertFalse(SaveProposal.shouldPropose(true, vault, "github.com"));
    }

    @Test
    public void proposesAgainOnceTheEntryIsDeleted() {
        Vault vault = new Vault();
        vault.upsertAccount("github.com", "moi", 20, true, true, true, true).deleted = true;
        assertTrue(SaveProposal.shouldPropose(true, vault, "github.com"));
    }

    @Test
    public void staysQuietWithoutSite() {
        assertFalse(SaveProposal.shouldPropose(true, new Vault(), "  "));
        assertFalse(SaveProposal.shouldPropose(true, new Vault(), null));
    }

    @Test
    public void keepsTheUsernameWhenItReproducesThePassword() {
        assertEquals("moi", SaveProposal.loginToStore("mdp[moi]", " moi ", DERIVER));
    }

    @Test
    public void dropsTheUsernameWhenThePasswordWasDerivedWithoutIt() {
        // Rempli par TheCode sur un site inconnu : sans identifiant. L'ajouter
        // changerait le mot de passe du compte.
        assertEquals("", SaveProposal.loginToStore("mdp[]", "moi", DERIVER));
    }

    @Test
    public void keepsTheUsernameForAForeignPassword() {
        assertEquals("moi", SaveProposal.loginToStore("hunter2", "moi", DERIVER));
        assertEquals("moi", SaveProposal.loginToStore(null, "moi", DERIVER));
        assertEquals("", SaveProposal.loginToStore("hunter2", null, DERIVER));
    }
}
