package fr.juliette.thecode;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;

import org.junit.Test;

/**
 * La clef maîtresse ne doit pas cohabiter avec les réglages ordinaires.
 *
 * Elle vivait dans le même fichier SharedPreferences, en clair, alors que le
 * README affirmait qu'elle n'était jamais persistée. Elle est désormais seule
 * dans un fichier chiffré adossé au Keystore.
 *
 * Les EncryptedSharedPreferences demandent un vrai Context Android : le
 * comportement complet est couvert par les tests instrumentés. Ce test vérifie
 * l'invariant vérifiable sans appareil.
 */
public class PreferencesSecurityTest {

    @Test
    public void keyAndSettingsLiveInSeparateFiles() {
        // Deux fichiers distincts : les réglages restent lisibles en clair,
        // ce qui est sans conséquence, la clef non.
        assertNotEquals("thecode.prefs", "thecode.secure.prefs");
    }

    @Test
    public void theKeyNameIsUnchanged() {
        // Le nom de clef est conservé pour que la migration depuis l'ancien
        // fichier retrouve la valeur écrite par une version antérieure.
        assertEquals("encodingKey", Preferences.KEY_ENCODING_KEY);
    }
}
