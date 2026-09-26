package fr.juliette.thecode.autofill;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** Repérage du champ identifiant, pour l'enregistrer avec le site. */
public class UsernameKeywordTest {

    @Test
    public void recognisesUsernameFields() {
        assertTrue(StructureParser.matchesUsernameKeyword("Username"));
        assertTrue(StructureParser.matchesUsernameKeyword("login_email"));
        assertTrue(StructureParser.matchesUsernameKeyword("Adresse e-mail"));
        assertTrue(StructureParser.matchesUsernameKeyword("Identifiant"));
        assertTrue(StructureParser.matchesUsernameKeyword("Nom d'utilisateur"));
    }

    @Test
    public void ignoresOtherFields() {
        assertFalse(StructureParser.matchesUsernameKeyword(null));
        assertFalse(StructureParser.matchesUsernameKeyword(""));
        assertFalse(StructureParser.matchesUsernameKeyword("Rechercher"));
        assertFalse(StructureParser.matchesUsernameKeyword("Code postal"));
    }
}
