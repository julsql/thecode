package fr.juliette.thecode.vault;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.util.Random;

/**
 * Le codec doit rendre exactement ce que produisent les quatre autres
 * implémentations, sinon rien ne se déchiffre d'un appareil à l'autre.
 */
public class Base64UrlTest {

    @Test
    public void encodesTheUrlSafeAlphabetWithoutPadding() {
        // 0xFB 0xFF contient les motifs qui donnent « + » et « / » en base64
        // standard : ils doivent sortir en « - » et « _ ».
        assertEquals("-_8", Base64Url.encode(new byte[]{(byte) 0xFB, (byte) 0xFF}));
        assertEquals("", Base64Url.encode(new byte[0]));
        assertEquals("QQ", Base64Url.encode("A".getBytes(StandardCharsets.UTF_8)));
        assertEquals("QUI", Base64Url.encode("AB".getBytes(StandardCharsets.UTF_8)));
        assertEquals("QUJD", Base64Url.encode("ABC".getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    public void decodesWhatItEncodes() {
        Random random = new Random(1789);
        for (int length = 0; length < 200; length++) {
            byte[] raw = new byte[length];
            random.nextBytes(raw);
            assertArrayEquals(raw, Base64Url.decode(Base64Url.encode(raw)));
        }
    }

    @Test
    public void acceptsTheStandardAlphabetAndPadding() {
        // Lire large, écrire strict : un payload venu d'ailleurs peut porter
        // l'alphabet standard, on ne veut pas le rejeter.
        assertArrayEquals(new byte[]{(byte) 0xFB, (byte) 0xFF}, Base64Url.decode("+/8="));
    }

    @Test
    public void refusesInvalidInput() {
        // Silencieusement ignorer rendrait un contenu tronqué que personne ne
        // remarquerait avant de constater un carnet incomplet.
        assertThrows(IllegalArgumentException.class, () -> Base64Url.decode("QQ*Q"));
        assertThrows(IllegalArgumentException.class, () -> Base64Url.decode("QQQQQ"));
    }

    @Test
    public void matchesTheJdkForTheSameBytes() {
        Random random = new Random(1804);
        for (int i = 0; i < 50; i++) {
            byte[] raw = new byte[random.nextInt(64)];
            random.nextBytes(raw);
            String expected = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
            assertEquals(expected, Base64Url.encode(raw));
        }
    }
}
