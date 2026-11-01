package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Arrays;

/** Identifiants proposés pour un site : ceux qui servent déjà ailleurs dans le carnet. */
public class LoginSuggestionsTest {

    private static Vault vault() {
        Vault vault = new Vault();
        vault.upsertAccount("a.fr", "zoe", 20, true, true, true, true);
        vault.upsertAccount("b.fr", "moi@exemple.fr", 20, true, true, true, true);
        vault.upsertAccount("c.fr", " moi@exemple.fr ", 20, true, true, true, true);
        vault.upsertAccount("d.fr", "alice", 20, true, true, true, true);
        vault.upsertAccount("e.fr", "", 20, true, true, true, true);
        vault.upsertAccount("vieux.fr", "ancien", 20, true, true, true, true);
        vault.entries.get(vault.entries.size() - 1).deleted = true;
        vault.upsertAccount("site.fr", "alice", 20, true, true, true, true);
        return vault;
    }

    @Test
    public void ranksByUseWithoutTheSiteOwnLogins() {
        // « alice » est déjà un compte du site.
        assertEquals(Arrays.asList("moi@exemple.fr", "zoe"),
                LoginSuggestions.of(vault(), "site.fr", 3));
    }

    @Test
    public void tiesAreAlphabeticalAndTheListIsBounded() {
        assertEquals(Arrays.asList("alice", "moi@exemple.fr"),
                LoginSuggestions.of(vault(), "autre.fr", 2));
    }

    @Test
    public void anEmptyVaultSuggestsNothing() {
        assertTrue(LoginSuggestions.of(new Vault(), "site.fr", 3).isEmpty());
    }
}
