package fr.juliette.thecode;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Rose en v1, bleu en v2, et un texte lisible sur le rose dans les deux thèmes. */
public class AlgoThemeTest {

    @Test
    public void v1GetsThePinkOverlayAndV2KeepsTheBaseTheme() {
        assertEquals(R.style.ThemeOverlay_TheCode_V1, AlgoTheme.overlayFor(true));
        assertEquals(0, AlgoTheme.overlayFor(false));
        assertNotEquals(AlgoTheme.overlayFor(true), AlgoTheme.overlayFor(false));
    }

    @Test
    public void contrastMatchesWcagReferenceValues() {
        assertEquals(21.0, AlgoTheme.contrast(0xFF000000, 0xFFFFFFFF), 0.01);
        assertEquals(1.0, AlgoTheme.contrast(0xFF777777, 0xFF777777), 0.01);
    }

    @Test
    public void buttonTextIsReadableOnPinkInLightAndDark() throws Exception {
        String colors = read("src/main/res/values/colors.xml");
        int pink = color(colors, "brand_pink");
        int pinkDark = color(colors, "brand_pink_dark");
        int white = color(colors, "background_light");
        int black = color(colors, "background_dark");

        // colorOnPrimary vaut background_light en clair, background_dark en sombre.
        assertTrue(AlgoTheme.contrast(pink, white) >= 4.5);
        assertTrue(AlgoTheme.contrast(pinkDark, black) >= 4.5);
    }

    private static String read(String path) throws Exception {
        File file = new File(path);
        if (!file.isFile()) file = new File("app/" + path);
        return new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
    }

    private static int color(String xml, String name) {
        Matcher m = Pattern.compile("name=\"" + name + "\">#([0-9A-Fa-f]{6,8})<").matcher(xml);
        if (!m.find()) throw new AssertionError("couleur absente : " + name);
        long value = Long.parseLong(m.group(1), 16);
        return (int) (m.group(1).length() == 6 ? value | 0xFF000000L : value);
    }
}
