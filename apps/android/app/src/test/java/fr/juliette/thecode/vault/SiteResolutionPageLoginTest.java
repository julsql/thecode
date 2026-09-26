package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * L'identifiant déjà saisi dans le formulaire désigne le compte à remplir —
 * même règle que le menu de l'extension.
 */
public class SiteResolutionPageLoginTest {

    private static Vault vaultWith(VaultEntry... entries) {
        Vault vault = new Vault();
        vault.entries.addAll(Arrays.asList(entries));
        return vault;
    }

    private static VaultEntry account(String siteKey, String login) {
        VaultEntry entry = VaultEntry.create(siteKey, Collections.singletonList("site.fr"));
        entry.login = login;
        return entry;
    }

    private static List<SiteResolution> resolve(Vault vault, String pageLogin) {
        return SiteResolution.forPageLogin(vault, "site.fr", pageLogin, 20,
                true, true, true, true);
    }

    @Test
    public void withoutTypedLoginProposesEveryAccount() {
        Vault vault = vaultWith(account("site.fr", "a@example.fr"),
                account("site.fr#b", "b@example.fr"));

        assertEquals(2, resolve(vault, null).size());
        assertEquals(2, resolve(vault, "   ").size());
    }

    @Test
    public void withoutTypedLoginUnknownSiteFallsBackWithoutLogin() {
        List<SiteResolution> out = resolve(new Vault(), "");

        assertEquals(1, out.size());
        assertEquals("", out.get(0).entryId);
        assertEquals("", out.get(0).login);
    }

    @Test
    public void typedLoginPicksTheMatchingAccount() {
        VaultEntry a = account("site.fr", "a@example.fr");
        VaultEntry b = account("site.fr#b", "b@example.fr");

        List<SiteResolution> out = resolve(vaultWith(a, b), " b@example.fr ");

        assertEquals(1, out.size());
        assertEquals(b.id, out.get(0).entryId);
        assertEquals("site.fr#b", out.get(0).siteKey);
    }

    @Test
    public void typedLoginKeepsTheOnlyEntrySavedWithoutLogin() {
        // Son mot de passe a été dérivé sans identifiant : le remplir ne doit
        // pas le changer.
        VaultEntry only = account("site.fr", null);

        List<SiteResolution> out = resolve(vaultWith(only), "a@example.fr");

        assertEquals(1, out.size());
        assertEquals(only.id, out.get(0).entryId);
        assertEquals("", out.get(0).login);
    }

    @Test
    public void typedLoginOnUnknownSiteDerivesWithIt() {
        List<SiteResolution> out = resolve(new Vault(), "a@example.fr");

        assertEquals(1, out.size());
        SiteResolution r = out.get(0);
        assertEquals("", r.entryId);
        assertEquals("site.fr", r.siteKey);
        assertEquals("a@example.fr", r.login);
        assertEquals(2, r.v);
        assertEquals(20, r.length);
    }

    @Test
    public void otherLoginThanTheOnlyAccountIsANewAccount() {
        VaultEntry only = account("site.fr", "a@example.fr");

        List<SiteResolution> out = resolve(vaultWith(only), "b@example.fr");

        assertEquals("", out.get(0).entryId);
        assertEquals("b@example.fr", out.get(0).login);
    }

    @Test
    public void unknownLoginAmongSeveralAccountsIsANewAccount() {
        // Plusieurs entrées, dont une sans identifiant : ce n'est pas « la
        // seule », l'identifiant saisi désigne un autre compte.
        Vault vault = vaultWith(account("site.fr", null), account("site.fr#b", "b@example.fr"));

        List<SiteResolution> out = resolve(vault, "c@example.fr");

        assertEquals("", out.get(0).entryId);
        assertEquals("c@example.fr", out.get(0).login);
    }

    @Test
    public void byIdRebuildsTheNewAccountFromThePageLogin() {
        SiteResolution r = SiteResolution.byId(new Vault(), "", "site.fr", "a@example.fr",
                20, true, true, true, true);

        assertEquals("a@example.fr", r.login);
        assertEquals("site.fr", r.siteKey);
    }

    @Test
    public void byIdWithoutPageLoginKeepsTheFallback() {
        SiteResolution r = SiteResolution.byId(new Vault(), "", "site.fr", null,
                20, true, true, true, true);

        assertEquals("", r.login);
        assertEquals(1, r.v);
    }

    @Test
    public void proposesToSaveOnlyWhatTheVaultDoesNotKnow() {
        VaultEntry only = account("site.fr", "a@example.fr");
        Vault vault = vaultWith(only);

        assertTrue(SaveProposal.shouldPropose(true, resolve(vault, "b@example.fr")));
        assertFalse(SaveProposal.shouldPropose(true, resolve(vault, "a@example.fr")));
        assertFalse(SaveProposal.shouldPropose(true, resolve(vault, "")));
        assertTrue(SaveProposal.shouldPropose(true, resolve(new Vault(), "")));
        assertFalse(SaveProposal.shouldPropose(false, resolve(new Vault(), "")));
    }

    @Test
    public void theTypedLoginIsTheOneToStore() {
        // Le mot de passe rempli pour un nouveau compte dérive avec
        // l'identifiant de la page : c'est lui qui le redonne.
        SaveProposal.Deriver deriver = login -> "derived:" + login;
        String filled = deriver.passwordFor("a@example.fr");

        assertEquals("a@example.fr", SaveProposal.loginToStore(filled, "a@example.fr", deriver));
    }
}
