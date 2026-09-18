package fr.juliette.thecode;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * Empreinte de la clef maîtresse.
 *
 * Vérifie aussi l'interopérabilité : la même clef doit donner la même empreinte
 * partout, sinon l'utilisateur verrait deux valeurs différentes selon
 * l'appareil et cesserait de s'y fier.
 */
public class FingerprintTest {

    @Test
    public void matchesTheOtherImplementations() {
        // Vecteur produit par le CLI Python, vérifié par l'extension et le site.
        assertEquals("KG8", Fingerprint.of("clef").text);
    }

    @Test
    public void isStable() {
        assertEquals(Fingerprint.of("clef").text, Fingerprint.of("clef").text);
    }

    @Test
    public void catchesATypo() {
        // C'est tout l'intérêt : une faute de frappe doit sauter aux yeux.
        assertNotEquals(Fingerprint.of("clef").text, Fingerprint.of("clef ").text);
        assertNotEquals(Fingerprint.of("clef").text, Fingerprint.of("Clef").text);
        assertNotEquals(Fingerprint.of("clef").text, Fingerprint.of("cled").text);
    }

    @Test
    public void usesAnUnambiguousAlphabet() {
        String text = Fingerprint.of("clef").text;
        assertEquals(3, text.length());
        for (char forbidden : new char[]{'0', '1', 'O', 'I', 'L'}) {
            assertTrue("caractere ambigu : " + forbidden, text.indexOf(forbidden) < 0);
        }
    }

    @Test
    public void emptyKeyHasNoFingerprint() {
        assertNull(Fingerprint.of(""));
    }

    @Test
    public void alsoGivesAColour() {
        // Opaque : une couleur à moitié transparente ne serait pas un repère.
        assertEquals(0xFF, (Fingerprint.of("clef").color >>> 24) & 0xFF);
    }
}
