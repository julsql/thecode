package fr.juliette.thecode;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import fr.juliette.thecode.vault.Vault;

/** Masquage du mot de passe généré et libellé du bouton d'enregistrement. */
public class GeneratedPasswordTest {

    private static String sample(int length) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < length; i++) b.append('x');
        return b.toString();
    }

    @Test
    public void masksByDefaultWithFixedLength() {
        assertEquals(GeneratedPassword.MASK, GeneratedPassword.display(sample(4), false));
        assertEquals(GeneratedPassword.MASK, GeneratedPassword.display(sample(40), false));
    }

    @Test
    public void revealsTheRealValueOnDemand() {
        String value = sample(12) + "y";
        assertEquals(value, GeneratedPassword.display(value, true));
    }

    @Test
    public void showsNothingWithoutPassword() {
        assertEquals("", GeneratedPassword.display("", false));
        assertEquals("", GeneratedPassword.display(null, true));
    }

    @Test
    public void proposesCreationForAnUnknownAccount() {
        Vault vault = new Vault();
        assertFalse(GeneratedPassword.hasEntry(vault, "example.com", "alice"));
        assertFalse(GeneratedPassword.hasEntry(vault, "  ", ""));
        assertFalse(GeneratedPassword.hasEntry(null, "example.com", ""));
    }

    @Test
    public void proposesUpdateWhenDomainAndLoginMatch() {
        Vault vault = new Vault();
        vault.upsertAccount("example.com", "alice", 20, true, true, true, true);

        assertTrue(GeneratedPassword.hasEntry(vault, " example.com ", "alice "));
        assertFalse(GeneratedPassword.hasEntry(vault, "example.com", "bob"));
        assertFalse(GeneratedPassword.hasEntry(vault, "example.com", ""));
    }
}
