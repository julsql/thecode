package fr.juliette.thecode;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

/**
 * Saisie de la longueur au clavier : une valeur partielle ou hors bornes doit
 * être rejetée (et bornée à la validation) plutôt qu'appliquée telle quelle.
 */
public class LengthInputTest {

    @Test
    public void acceptsValueInsideBounds() {
        assertEquals(Integer.valueOf(30), MainActivity.parseLength("30"));
        assertEquals(Integer.valueOf(Code.MIN_LENGTH),
                MainActivity.parseLength(String.valueOf(Code.MIN_LENGTH)));
        assertEquals(Integer.valueOf(Code.MAX_LENGTH),
                MainActivity.parseLength(String.valueOf(Code.MAX_LENGTH)));
    }

    @Test
    public void toleratesSurroundingWhitespace() {
        assertEquals(Integer.valueOf(30), MainActivity.parseLength("  30 "));
    }

    /** « 3 », frappe intermédiaire de « 30 » : refusée sans être corrigée. */
    @Test
    public void rejectsValueBelowMinimum() {
        assertNull(MainActivity.parseLength("3"));
    }

    @Test
    public void rejectsValueAboveMaximum() {
        assertNull(MainActivity.parseLength("99"));
    }

    @Test
    public void rejectsEmptyOrNonNumericInput() {
        assertNull(MainActivity.parseLength(""));
        assertNull(MainActivity.parseLength("   "));
        assertNull(MainActivity.parseLength("abc"));
    }
}
