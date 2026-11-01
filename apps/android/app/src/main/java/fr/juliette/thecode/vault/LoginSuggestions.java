package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * Identifiants à proposer pour un site : ceux qui servent déjà ailleurs dans
 * le carnet, les plus utilisés d'abord (à égalité, ordre alphabétique), sans
 * ceux que le site a déjà. Même règle sur tous les clients.
 */
public final class LoginSuggestions {

    public static final int DEFAULT_LIMIT = 3;

    private LoginSuggestions() { }

    @NonNull
    public static List<String> of(@NonNull Vault vault, @NonNull String domain, int limit) {
        Set<String> taken = new HashSet<>();
        for (VaultEntry entry : vault.findAllByDomain(domain.trim().toLowerCase())) {
            taken.add(SiteResolution.normalizeLogin(entry.login));
        }
        // TreeMap : l'ordre alphabétique départage, le tri par usage est stable.
        Map<String, Integer> uses = new TreeMap<>();
        for (VaultEntry entry : vault.entries) {
            String login = SiteResolution.normalizeLogin(entry.login);
            if (entry.deleted || login.isEmpty() || taken.contains(login)) continue;
            Integer seen = uses.get(login);
            uses.put(login, seen == null ? 1 : seen + 1);
        }
        List<Map.Entry<String, Integer>> ranked = new ArrayList<>(uses.entrySet());
        ranked.sort((a, b) -> b.getValue() - a.getValue());
        List<String> logins = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : ranked) {
            if (logins.size() >= limit) break;
            logins.add(entry.getKey());
        }
        return logins;
    }
}
