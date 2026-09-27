package fr.juliette.thecode.autofill;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

import fr.juliette.thecode.vault.SiteResolution;

public class UsernameFillTest {

    @Test
    public void fillsAccountLoginWhenFieldIsEmpty() {
        assertEquals("demo@example.com", UsernameFill.loginToFill("demo@example.com", ""));
        assertEquals("demo@example.com", UsernameFill.loginToFill("demo@example.com", null));
        assertEquals("demo@example.com", UsernameFill.loginToFill("demo@example.com", "   "));
    }

    @Test
    public void fillsAccountLoginWhenFieldAlreadyHoldsIt() {
        assertEquals("demo@example.com",
                UsernameFill.loginToFill("demo@example.com", "demo@example.com"));
        assertEquals("demo@example.com",
                UsernameFill.loginToFill("demo@example.com", " demo@example.com "));
    }

    @Test
    public void neverOverwritesAnotherTypedLogin() {
        assertNull(UsernameFill.loginToFill("demo@example.com", "other@example.com"));
        // Casse différente : un autre identifiant pour le carnet.
        assertNull(UsernameFill.loginToFill("demo@example.com", "Demo@example.com"));
    }

    @Test
    public void leavesFieldAloneForAccountWithoutLogin() {
        assertNull(UsernameFill.loginToFill("", ""));
        assertNull(UsernameFill.loginToFill((String) null, "typed"));
        assertNull(UsernameFill.loginToFill("", "typed"));
    }

    @Test
    public void newAccountFromPageLoginKeepsTypedLogin() {
        SiteResolution r = SiteResolution.newAccount("instagram.com", "typed@example.com",
                16, true, true, true, true);
        assertEquals("typed@example.com", UsernameFill.loginToFill(r, "typed@example.com"));
    }

    @Test
    public void fallbackWithoutLoginDoesNotFill() {
        SiteResolution r = SiteResolution.fallback("instagram.com", 16, true, true, true, true);
        assertNull(UsernameFill.loginToFill(r, ""));
    }
}
