package fr.juliette.thecode.autofill;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

/**
 * Vérifie que des entrées équivalentes (URL, sous-domaines, etc.) produisent
 * le même domaine canonique — ce qui garantit le même mot de passe généré.
 */
public class DomainNormalizerTest {

    private static String normalize(String input) {
        // Méthode package-private : on est dans le même package.
        return DomainNormalizer.normalize(input);
    }

    private static String normalizePackage(String input) {
        return DomainNormalizer.normalize(input, true);
    }

    @Test
    public void plainDomain() {
        assertEquals("example.com", normalize("example.com"));
    }

    @Test
    public void stripsScheme() {
        assertEquals("example.com", normalize("https://example.com"));
    }

    @Test
    public void stripsLeadingWww() {
        assertEquals("example.com", normalize("www.example.com"));
    }

    @Test
    public void stripsPathQueryAndFragment() {
        assertEquals("example.com", normalize("https://example.com/login?next=/x"));
    }

    @Test
    public void stripsPort() {
        assertEquals("example.com", normalize("https://example.com:8443/foo"));
    }

    @Test
    public void stripsUserInfo() {
        assertEquals("example.com", normalize("https://user@example.com"));
    }

    @Test
    public void keepsRegistrableDomain() {
        assertEquals("google.com", normalize("https://accounts.google.com/signin"));
    }

    @Test
    public void packageNameIsLowercasedTrimmed() {
        assertEquals("chrome", normalizePackage("  CHROME  "));
    }

    /**
     * Un package Android (reverse-DNS) est inversé pour retomber sur le
     * domaine web correspondant — ainsi un mot de passe généré dans le
     * navigateur fonctionne aussi quand l'utilisateur ouvre l'app native.
     */
    @Test
    public void packageReverseToRegistrableDomain() {
        assertEquals("instagram.com", normalizePackage("com.instagram.android"));
        assertEquals("facebook.com", normalizePackage("com.facebook.katana"));
        assertEquals("spotify.com", normalizePackage("com.spotify.music"));
        assertEquals("mozilla.org", normalizePackage("org.mozilla.firefox"));
    }

    @Test
    public void emptyAndNullAreEmpty() {
        assertEquals("", normalize(""));
        assertEquals("", normalize(null));
    }

    /**
     * Régression : les deux formes vues par Safari (avec ou sans préfixe www.)
     * doivent canoniquement produire le même domaine, donc le même mot de passe.
     */
    @Test
    public void instagramWithAndWithoutWwwAreEquivalent() {
        String a = normalize("instagram.com");
        String b = normalize("www.instagram.com");
        String c = normalize("https://www.instagram.com/accounts/login");
        assertEquals("instagram.com", a);
        assertEquals(a, b);
        assertEquals(a, c);
    }

    /**
     * Régression : même mot de passe à partir d'un sous-domaine de service.
     */
    @Test
    public void googleSubdomainsCollapseToRegistrableDomain() {
        assertEquals("google.com", normalize("accounts.google.com"));
        assertEquals("google.com", normalize("www.google.com"));
        assertEquals("google.com", normalize("https://mail.google.com/u/0/"));
    }
}
