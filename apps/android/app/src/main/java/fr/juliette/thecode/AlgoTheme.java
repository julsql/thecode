package fr.juliette.thecode;

import androidx.annotation.StyleRes;

/**
 * Couleur de l'écran selon l'algorithme : bleu en v2, rose en v1.
 *
 * La v1 est une exception ; un écran qui change de couleur empêche de générer
 * en v1 sans s'en rendre compte, là où un libellé dans la barre passe inaperçu.
 */
final class AlgoTheme {

    private AlgoTheme() {}

    /** Surcouche à appliquer au thème, 0 pour garder le thème de base (v2). */
    @StyleRes
    static int overlayFor(boolean useV1) {
        return useV1 ? R.style.ThemeOverlay_TheCode_V1 : 0;
    }

    /** Rapport de contraste WCAG entre deux couleurs ARGB opaques. */
    static double contrast(int a, int b) {
        double la = luminance(a);
        double lb = luminance(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    private static double luminance(int color) {
        return 0.2126 * channel((color >> 16) & 0xFF)
                + 0.7152 * channel((color >> 8) & 0xFF)
                + 0.0722 * channel(color & 0xFF);
    }

    private static double channel(int value) {
        double c = value / 255.0;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
}
