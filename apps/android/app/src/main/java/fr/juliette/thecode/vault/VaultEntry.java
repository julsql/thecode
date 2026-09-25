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
    /**
     * Seule version admise dans le carnet. La v1 ne subsiste qu'en génération
     * ponctuelle, hors carnet : shared/spec/vault-merge.md.
     */
    public static final int VERSION = 2;

    public int v = VERSION;
    /** Absent des entrées antérieures au champ : {@code updatedAt} en tient lieu. */
    @Nullable
    public String createdAt = null;
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
        e.createdAt = e.updatedAt;
        return e;
    }

    /**
     * Copie une entrée, pour prévisualiser un changement sans l'appliquer.
     *
     * Modifier l'entrée du carnet puis revenir en arrière laisserait la porte
     * ouverte à un carnet enregistré à mi-chemin.
     */
    public static VaultEntry copyOf(@NonNull VaultEntry other) {
        VaultEntry e = new VaultEntry();
        e.id = other.id;
        e.label = other.label;
        e.siteKey = other.siteKey;
        e.domains = new ArrayList<>(other.domains);
        e.login = other.login;
        e.counter = other.counter;
        e.length = other.length;
        e.lower = other.lower;
        e.upper = other.upper;
        e.symbols = other.symbols;
        e.numbers = other.numbers;
        e.v = other.v;
        e.createdAt = other.createdAt;
        e.updatedAt = other.updatedAt;
        e.deleted = other.deleted;
        return e;
    }

    /** Faux pour une entrée que le carnet écarte à la lecture et refuse à l'écriture. */
    public boolean isSupported() {
        return v == VERSION;
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
        e.createdAt = o.has("createdAt") && !o.isNull("createdAt")
                ? o.getString("createdAt") : null;
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
        // Absent quand inconnu, comme dans la forme canonique des autres clients.
        if (createdAt != null) o.put("createdAt", createdAt);
        o.put("updatedAt", updatedAt);
        if (deleted) o.put("deleted", true);
        return o;
    }

    /**
     * Forme canonique, pour départager sans dépendre de l'ordre.
     *
     * Écrite à la main plutôt que via {@code JSONObject.toString()}, qui ne
     * trie pas les clefs et échappe {@code /} en {@code \/}. La forme est fixée
     * par shared/spec/vault-merge.md : deux appareils qui n'écrivent pas la
     * même chaîne désignent un gagnant différent et ne convergent jamais.
     *
     * Part de {@link #toJson()} pour que la liste des champs ne vive qu'à un
     * seul endroit.
     */
    String canonical() {
        try {
            JSONObject json = toJson();
            // Absent quand faux : des carnets écrits par des versions
            // antérieures en portent un, et il ne doit pas peser dans le
            // départage.
            json.remove("deleted");
            if (deleted) json.put("deleted", true);

            StringBuilder out = new StringBuilder();
            writeValue(out, json);
            return out.toString();
        } catch (JSONException e) {
            return id;
        }
    }

    private static void writeValue(StringBuilder out, Object value) throws JSONException {
        if (value instanceof JSONObject) {
            JSONObject object = (JSONObject) value;
            List<String> keys = new ArrayList<>();
            for (java.util.Iterator<String> it = object.keys(); it.hasNext(); ) {
                keys.add(it.next());
            }
            // Collections.sort plutot que List#sort, qui demande l'API 24.
            java.util.Collections.sort(keys);

            out.append('{');
            for (int i = 0; i < keys.size(); i++) {
                if (i > 0) out.append(',');
                writeString(out, keys.get(i));
                out.append(':');
                writeValue(out, object.get(keys.get(i)));
            }
            out.append('}');
            return;
        }

        if (value instanceof JSONArray) {
            JSONArray array = (JSONArray) value;
            out.append('[');
            for (int i = 0; i < array.length(); i++) {
                if (i > 0) out.append(',');
                writeValue(out, array.get(i));
            }
            out.append(']');
            return;
        }

        if (value instanceof String) {
            writeString(out, (String) value);
            return;
        }

        out.append(value);
    }

    /**
     * Échappement JSON minimal.
     *
     * Ni {@code /}, que org.json échappe, ni d'échappement unicode pour les
     * accents : les autres implémentations les écrivent tels quels.
     *
     * La séquence unicode n'apparaît pas en toutes lettres dans ce commentaire
     * parce que javac l'interprète même là, et refuse alors de compiler.
     */
    private static void writeString(StringBuilder out, String value) {
        out.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"': out.append("\\\""); break;
                case '\\': out.append("\\\\"); break;
                case '\n': out.append("\\n"); break;
                case '\r': out.append("\\r"); break;
                case '\t': out.append("\\t"); break;
                case '\b': out.append("\\b"); break;
                case '\f': out.append("\\f"); break;
                default:
                    // Seuls les caractères de contrôle sont échappés.
                    if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
                    else out.append(c);
            }
        }
        out.append('"');
    }

    boolean coversDomain(String domain) {
        for (String d : domains) {
            if (d.equalsIgnoreCase(domain)) return true;
        }
        return false;
    }
}
