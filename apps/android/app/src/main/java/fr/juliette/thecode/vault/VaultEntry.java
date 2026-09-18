package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Une entrée du carnet.
 *
 * Ne contient jamais de mot de passe ni de clef maîtresse : seulement de quoi
 * rejouer une dérivation. Une fuite révèle les sites et les identifiants, pas
 * les mots de passe.
 *
 * Schéma : shared/vault.schema.json
 */
public final class VaultEntry {

    public String id;
    public String label;
    /**
     * Chaîne réellement passée à la dérivation. Figée à la création : elle ne
     * suit pas les évolutions de la canonicalisation, sinon un changement de
     * PSL modifierait des mots de passe existants.
     */
    public String siteKey;
    public List<String> domains = new ArrayList<>();
    public String login = null;
    public int counter = 1;
    public int length = 20;
    public boolean lower = true;
    public boolean upper = true;
    public boolean symbols = true;
    public boolean numbers = true;
    public int v = 1;
    public String updatedAt;
    public boolean deleted = false;

    public static VaultEntry create(@NonNull String siteKey, @Nullable List<String> domains) {
        VaultEntry e = new VaultEntry();
        e.id = UUID.randomUUID().toString();
        e.label = siteKey;
        e.siteKey = siteKey;
        e.domains = new ArrayList<>(domains == null || domains.isEmpty()
                ? List.of(siteKey) : domains);
        java.util.Collections.sort(e.domains);
        e.updatedAt = Vault.nowIso();
        return e;
    }

    static VaultEntry fromJson(JSONObject o) throws JSONException {
        VaultEntry e = new VaultEntry();
        e.id = o.getString("id");
        // Pas de valeur par defaut : inventer un label ferait diverger le
        // round-trip JSON des autres implementations, et donc la fusion.
        e.label = o.has("label") ? o.getString("label") : null;
        e.siteKey = o.getString("siteKey");
        JSONArray domains = o.getJSONArray("domains");
        for (int i = 0; i < domains.length(); i++) {
            e.domains.add(domains.getString(i));
        }
        e.login = o.has("login") ? o.getString("login") : null;
        e.counter = o.getInt("counter");
        e.length = o.getInt("length");
        JSONObject charset = o.getJSONObject("charset");
        e.lower = charset.getBoolean("lower");
        e.upper = charset.getBoolean("upper");
        e.symbols = charset.getBoolean("symbols");
        e.numbers = charset.getBoolean("numbers");
        e.v = o.getInt("v");
        e.updatedAt = o.getString("updatedAt");
        e.deleted = o.optBoolean("deleted", false);
        return e;
    }

    JSONObject toJson() throws JSONException {
        JSONObject o = new JSONObject();
        o.put("id", id);
        if (label != null) o.put("label", label);
        o.put("siteKey", siteKey);
        o.put("domains", new JSONArray(domains));
        if (login != null) o.put("login", login);
        o.put("counter", counter);
        o.put("length", length);
        JSONObject charset = new JSONObject();
        charset.put("lower", lower);
        charset.put("upper", upper);
        charset.put("symbols", symbols);
        charset.put("numbers", numbers);
        o.put("charset", charset);
        o.put("v", v);
        o.put("updatedAt", updatedAt);
        if (deleted) o.put("deleted", true);
        return o;
    }

    /** Représentation stable, pour départager sans dépendre de l'ordre. */
    String canonical() {
        try {
            return toJson().toString();
        } catch (JSONException e) {
            return id;
        }
    }

    boolean coversDomain(String domain) {
        for (String d : domains) {
            if (d.equalsIgnoreCase(domain)) return true;
        }
        return false;
    }
}
