package fr.juliette.thecode;

import static org.junit.Assert.assertEquals;

import fr.juliette.thecode.KeyStrength.Level;
import org.junit.Test;

/** Robustesse de la clef : mêmes seuils partout (shared/spec/key-strength.md). */
public class KeyStrengthTest {

    private static String repeat(String s, int n) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < n; i++) b.append(s);
        return b.toString();
    }

    @Test
    public void emptyKeyShowsNothing() {
        assertEquals(Level.NONE, KeyStrength.of(""));
        assertEquals(Level.NONE, KeyStrength.of(null));
    }

    @Test
    public void sharedExamples() {
        assertEquals(Level.WEAK, KeyStrength.of("soleil"));
        assertEquals(Level.WEAK, KeyStrength.of("Abc 12!"));
        assertEquals(Level.WEAK, KeyStrength.of("soleilrouge"));
        assertEquals(Level.WEAK, KeyStrength.of("SOLEILROUGE"));
        assertEquals(Level.FAIR, KeyStrength.of("Soleil rouge"));
        assertEquals(Level.FAIR, KeyStrength.of("soleilrouge7"));
        assertEquals(Level.STRONG, KeyStrength.of("un chat va ici"));
        assertEquals(Level.STRONG, KeyStrength.of("unephrasesansespace"));
    }

    @Test
    public void countsCodePointsNotUtf16Units() {
        assertEquals(Level.WEAK, KeyStrength.of(repeat("🌙", 9)));
        assertEquals(Level.WEAK, KeyStrength.of(repeat("é", 10)));
        assertEquals(Level.FAIR, KeyStrength.of(repeat("é", 9) + "a"));
    }

    @Test
    public void thresholdsAreExact() {
        assertEquals(Level.WEAK, KeyStrength.of(repeat("a", 9)));
        assertEquals(Level.WEAK, KeyStrength.of(repeat("a", 15)));
        assertEquals(Level.STRONG, KeyStrength.of(repeat("a", 16)));
        assertEquals(Level.STRONG, KeyStrength.of("ab cd ef gh"));
        assertEquals(Level.FAIR, KeyStrength.of("abc def ghi"));
        assertEquals(Level.STRONG, KeyStrength.of("ab\tcd\nef\rgh"));
    }
}
