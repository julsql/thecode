package fr.juliette.thecode;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.List;

/**
 * Tests reproduits depuis l'ancienne application TheCode_Android.
 * Les vecteurs de référence garantissent la compatibilité de l'algorithme
 * entre l'application Apple et l'application Android.
 */
public class CodeUnitTest {

    @Test
    public void generate_referenceVector_clefSite() {
        Code code = new Code();
        code.setLength(20);
        String result = code.getCode("clef", "site");
        assertEquals("u8YfpdVdK*#Bpy6(9f*5", result);
    }

    @Test
    public void generate_referenceVector_singleCharInputs() {
        Code code = new Code();
        code.setLength(20);
        String result = code.getCode("c", "s");
        assertEquals("wDwWUk$@<%r1f:YvVqUI", result);
    }

    @Test
    public void generate_isDeterministic() {
        Code a = new Code();
        Code b = new Code();
        assertEquals(a.getCode("clef", "site"), b.getCode("clef", "site"));
    }

    @Test
    public void generate_differentSitesYieldDifferentPasswords() {
        Code code = new Code();
        assertNotEquals(code.getCode("k", "alpha"), code.getCode("k", "beta"));
    }

    @Test
    public void generate_lengthIsRespected() {
        Code code = new Code();
        for (int len = Code.MIN_LENGTH; len <= Code.MAX_LENGTH; len++) {
            code.setLength(len);
            assertEquals(len, code.getCode("anyKey", "anySite").length());
        }
    }

    @Test
    public void generate_emptyWhenNoCharsetActive() {
        Code code = new Code();
        code.setMinState(false);
        code.setMajState(false);
        code.setSymState(false);
        code.setChiState(false);
        assertEquals("", code.getCode("clef", "site"));
    }

    @Test
    public void bits_zeroWhenNoCharsetActive() {
        Code code = new Code();
        code.setMinState(false);
        code.setMajState(false);
        code.setSymState(false);
        code.setChiState(false);
        assertEquals(0, code.getBits());
    }

    @Test
    public void bits_increaseWithLength() {
        Code shorter = new Code();
        shorter.setLength(10);
        Code longer = new Code();
        longer.setLength(30);
        assertTrue(longer.getBits() > shorter.getBits());
    }

    @Test
    public void safety_labelMatchesEntropyBuckets() {
        Code code = new Code();
        code.setMinState(false);
        code.setMajState(false);
        code.setSymState(false);
        code.setChiState(false);
        code.updateSafetyAndColor();
        assertEquals(Code.SafetyLevel.NONE, code.getSafetyLevel());

        code.setMinState(true);
        code.setMajState(true);
        code.setSymState(true);
        code.setChiState(true);
        code.setLength(20);
        code.updateSafetyAndColor();
        assertEquals(Code.SafetyLevel.VERY_STRONG, code.getSafetyLevel());
    }

    @Test
    public void applyCharsetReplacement_includesAllGroupsAtLeastOnce() {
        Code code = new Code();
        code.setLength(20);
        String pwd = code.getCode("masterKey", "github");
        assertTrue("contient une minuscule", pwd.matches(".*[a-z].*"));
        assertTrue("contient une majuscule", pwd.matches(".*[A-Z].*"));
        assertTrue("contient un chiffre", pwd.matches(".*[1-9].*"));
        assertTrue("contient un symbole", pwd.matches(".*[@#&!)\\-%;<:*$+=/?>(].*"));
    }

    @Test(expected = IllegalArgumentException.class)
    public void applyCharsetReplacement_throwsWhenPasswordTooShort() {
        Code.applyCharsetReplacement(BigInteger.ONE, "ab", Arrays.asList("a", "b", "c"));
    }

    @Test
    public void uniquePosition_doesNotReuseExistingPositions() {
        List<Integer> used = Arrays.asList(0, 1, 2);
        int pos = Code.uniquePosition(BigInteger.ZERO, used, 5);
        assertTrue(pos == 3 || pos == 4);
    }
}
