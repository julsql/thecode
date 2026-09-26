package fr.juliette.thecode;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Règles de paiement des magasins : l'offre payante se vend sur le site, et
 * l'app ne doit y orienter par aucun texte. Garde-fou sur les chaînes
 * affichées : un nom d'offre, un prix ou une invitation à s'abonner qui s'y
 * glisserait ferait refuser l'app.
 */
public class StoreComplianceTest {

    private static final String[] FORBIDDEN = {
            "offre gratuite", "offre complète", "free plan", "full plan", "paid plan",
            "abonn", "subscri", "upgrade", "débloquer", "tarif", "pricing", "€",
    };

    @Test
    public void noDisplayedStringPointsToThePaidPlan() throws IOException {
        for (String path : new String[] {
                "src/main/res/values/strings.xml", "src/main/res/values-fr/strings.xml"}) {
            Matcher strings = Pattern.compile("<string name=\"([^\"]+)\"[^>]*>(.*?)</string>",
                    Pattern.DOTALL).matcher(read(path));
            while (strings.find()) {
                String text = strings.group(2).toLowerCase(Locale.ROOT);
                for (String word : FORBIDDEN) {
                    assertFalse(path + " : " + strings.group(1) + " contient « " + word + " »",
                            text.contains(word));
                }
            }
        }
    }

    @Test
    public void theAccountLinkAsksTheSiteToHidePrices() throws IOException {
        for (String path : new String[] {
                "src/main/res/values/strings.xml", "src/main/res/values-fr/strings.xml"}) {
            Matcher links = Pattern.compile("https://thecode\\.julsql\\.fr[^\\s<\"]*")
                    .matcher(read(path));
            while (links.find()) {
                assertTrue(path + " : " + links.group(), links.group().endsWith("?from=app"));
            }
        }
    }

    private static String read(String path) throws IOException {
        File file = new File(path);
        if (!file.isFile()) file = new File("app/" + path);
        return new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
    }
}
