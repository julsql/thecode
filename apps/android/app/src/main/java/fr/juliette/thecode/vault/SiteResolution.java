package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.ArrayList;
import java.util.List;

/**
 * Ce qu'il faut pour générer un mot de passe pour un domaine donné.
 *
 * Le carnet répond à trois questions qu'un domaine seul ne suffit pas à
 * trancher : sous quelle clef dériver (un même compte peut couvrir google.com
 * et google.fr), avec quels réglages (on ne les retient pas de tête), et pour
 * lequel des comptes du site.
 *
 * Quand le carnet ne connaît pas le domaine, on retombe sur les réglages
 * généraux et le domaine tel quel — c'est le comportement d'avant le carnet, et
 * il doit rester identique au caractère près.
 */
public final class SiteResolution {

    /** Identifiant de l'entrée, vide quand le carnet ne connaît pas le site. */
    public final String entryId;
    /** Ce qui s'affiche dans la liste de suggestions. */
    public final String label;

    public final String siteKey;
    public final String login;
    public final int counter;
    public final int v;

    public final int length;
    public final boolean lower;
    public final boolean upper;
    public final boolean symbols;
    public final boolean numbers;

    private SiteResolution(String entryId, String label, String siteKey, String login,
                           int counter, int v, int length,
                           boolean lower, boolean upper, boolean symbols, boolean numbers) {
        this.entryId = entryId;
        this.label = label;
        this.siteKey = siteKey;
        this.login = login;
        this.counter = counter;
        this.v = v;
        this.length = length;
        this.lower = lower;
        this.upper = upper;
        this.symbols = symbols;
        this.numbers = numbers;
    }

    static SiteResolution of(@NonNull VaultEntry entry) {
        String label = entry.label != null && !entry.label.isEmpty() ? entry.label : entry.siteKey;
        if (entry.login != null && !entry.login.isEmpty()) {
            label = label + " · " + entry.login;
        }
        return new SiteResolution(entry.id, label, entry.siteKey,
                entry.login == null ? "" : entry.login, entry.counter, entry.v,
                entry.length, entry.lower, entry.upper, entry.symbols, entry.numbers);
    }

    /** Le comportement d'avant le carnet, pour un site qu'il ne connaît pas. */
    public static SiteResolution fallback(@NonNull String domain, int length,
                                          boolean lower, boolean upper,
                                          boolean symbols, boolean numbers) {
        return new SiteResolution("", domain, domain, "", 1, 1,
                length, lower, upper, symbols, numbers);
    }

    /**
     * Toutes les façons de remplir ce domaine, dans l'ordre d'affichage.
     *
     * Plusieurs entrées pour un même domaine, c'est plusieurs comptes : on les
     * propose toutes plutôt que d'en choisir une au hasard — c'était le premier
     * des problèmes d'usage.
     */
    public static List<SiteResolution> forDomain(@NonNull Vault vault, @NonNull String domain,
                                                 int length, boolean lower, boolean upper,
                                                 boolean symbols, boolean numbers) {
        List<SiteResolution> out = new ArrayList<>();
        for (VaultEntry entry : vault.findAllByDomain(domain)) {
            out.add(of(entry));
        }
        if (out.isEmpty()) {
            out.add(fallback(domain, length, lower, upper, symbols, numbers));
        }
        return out;
    }

    /**
     * Retrouve une résolution par identifiant d'entrée.
     *
     * Rend le repli quand l'identifiant est vide, ou quand l'entrée a disparu
     * entre la suggestion et la validation — une synchronisation a pu passer
     * entre les deux.
     */
    @NonNull
    public static SiteResolution byId(@NonNull Vault vault, @Nullable String entryId,
                                      @NonNull String domain, int length, boolean lower,
                                      boolean upper, boolean symbols, boolean numbers) {
        if (entryId != null && !entryId.isEmpty()) {
            for (VaultEntry entry : vault.entries) {
                if (!entry.deleted && entry.id.equals(entryId)) return of(entry);
            }
        }
        return fallback(domain, length, lower, upper, symbols, numbers);
    }
}
