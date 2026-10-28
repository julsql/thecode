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

    @Test
    public void recognisesWebFieldsByTheirHtmlAttributes() {
        // Grafana : <input name="user" placeholder="email or username">.
        assertTrue(StructureParser.matchesUsernameAttribute("name", "user"));
        assertTrue(StructureParser.matchesUsernameAttribute("placeholder", "email or username"));
        assertTrue(StructureParser.matchesUsernameAttribute("ID", "Login_Field"));
        assertTrue(StructureParser.matchesUsernameAttribute("aria-label", "Identifiant"));
        assertTrue(StructureParser.matchesUsernameAttribute("type", "email"));
        assertTrue(StructureParser.matchesUsernameAttribute("autocomplete", "section-a username"));
    }

    @Test
    public void ignoresUnrelatedHtmlAttributes() {
        assertFalse(StructureParser.matchesUsernameAttribute("name", "q"));
        assertFalse(StructureParser.matchesUsernameAttribute("type", "text"));
        assertFalse(StructureParser.matchesUsernameAttribute("autocomplete", "off"));
        // Une classe CSS ou une valeur ne disent rien du rôle du champ.
        assertFalse(StructureParser.matchesUsernameAttribute("class", "user-input"));
        assertFalse(StructureParser.matchesUsernameAttribute("value", "user"));
        assertFalse(StructureParser.matchesUsernameAttribute(null, "user"));
        assertFalse(StructureParser.matchesUsernameAttribute("name", null));
    }
}
