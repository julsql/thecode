package fr.juliette.thecode.vault;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

/**
 * Carnet de métadonnées.
 *
 * Le carnet ne contient jamais de mot de passe ni de clef maîtresse. Une fuite
 * révèle les sites et les identifiants, pas les mots de passe.
 *
 * Règles de fusion : shared/spec/vault-merge.md
 */
public final class Vault {

    private static final String TAG = "TheCode";
    private static final String FILENAME = "vault.json";
    public static final int SCHEMA = 1;

    public String updatedAt = nowIso();
    public final List<VaultEntry> entries = new ArrayList<>();

    /** Un désaccord que la fusion refuse de trancher toute seule. */
    public static final class Conflict {
        public final String kind;
        public final String entryId;
        public final String detail;

        Conflict(String kind, String entryId, String detail) {
            this.kind = kind;
            this.entryId = entryId;
            this.detail = detail;
        }
    }

    static String nowIso() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.ROOT);
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        return fmt.format(new Date());
    }

    /** Entrées couvrant ce domaine. Plusieurs = plusieurs comptes sur le site. */
    @NonNull
    public List<VaultEntry> findAllByDomain(String domain) {
        List<VaultEntry> out = new ArrayList<>();
        for (VaultEntry e : entries) {
            if (!e.deleted && e.coversDomain(domain)) out.add(e);
        }
        return out;
    }

    @Nullable
    public VaultEntry findByDomain(String domain) {
        List<VaultEntry> all = findAllByDomain(domain);
        return all.isEmpty() ? null : all.get(0);
    }

    /**
     * Fusionne deux carnets. Commutative et idempotente : l'ordre de
     * synchronisation des appareils ne doit pas changer le résultat.
     */
    public static Vault merge(Vault left, Vault right, List<Conflict> conflicts) {
        Map<String, VaultEntry> byId = new LinkedHashMap<>();
        for (VaultEntry e : left.entries) byId.put(e.id, e);

        for (VaultEntry incoming : right.entries) {
            VaultEntry existing = byId.get(incoming.id);
            byId.put(incoming.id,
                    existing == null ? incoming : mergeEntry(existing, incoming, conflicts));
        }

        Vault merged = new Vault();
        merged.entries.addAll(byId.values());
        // Collections.sort plutot que List#sort, qui demande l'API 24.
        java.util.Collections.sort(merged.entries, (a, b) -> a.id.compareTo(b.id));

        String latest = left.updatedAt.compareTo(right.updatedAt) >= 0
                ? left.updatedAt : right.updatedAt;
        for (VaultEntry e : merged.entries) {
            if (e.updatedAt.compareTo(latest) > 0) latest = e.updatedAt;
        }
        merged.updatedAt = latest;
        return merged;
    }

    private static VaultEntry mergeEntry(VaultEntry left, VaultEntry right,
                                         List<Conflict> conflicts) {
        // Égalité d'horodatage : on départage sur la représentation canonique.
        // Départager sur la position ne serait pas commutatif — chaque appareil
        // garderait le sien — et l'id ne peut pas servir, les deux entrées
        // portent la même.
        VaultEntry winner;
        int byDate = left.updatedAt.compareTo(right.updatedAt);
        if (byDate != 0) {
            winner = byDate > 0 ? left : right;
        } else {
            winner = left.canonical().compareTo(right.canonical()) <= 0 ? left : right;
        }

        VaultEntry merged = new VaultEntry();
        merged.id = left.id;
        merged.label = winner.label;
        merged.login = winner.login;
        merged.length = winner.length;
        merged.lower = winner.lower;
        merged.upper = winner.upper;
        merged.symbols = winner.symbols;
        merged.numbers = winner.numbers;
        merged.v = winner.v;

        // siteKey produit le mot de passe : on ne choisit jamais à la place de
        // l'utilisateur. On garde celui de gauche et on signale.
        merged.siteKey = winner.siteKey;
        if (!left.siteKey.equals(right.siteKey)) {
            conflicts.add(new Conflict("sitekey-divergent", left.id,
                    left.siteKey + " vs " + right.siteKey));
            merged.siteKey = left.siteKey;
        }

        // Union : une addition de chaque côté ne doit pas en effacer une autre.
        List<String> domains = new ArrayList<>(left.domains);
        for (String d : right.domains) {
            if (!domains.contains(d)) domains.add(d);
        }
        java.util.Collections.sort(domains);
        merged.domains = domains;

        // Un compteur ne recule pas : une valeur haute signifie déjà renouvelé.
        int high = Math.max(left.counter, right.counter);
        int low = Math.min(left.counter, right.counter);
        merged.counter = high;
        if (high != low && winner.counter == low) {
            conflicts.add(new Conflict("counter-recul", left.id,
                    "le plus recent porte " + low + ", on garde " + high));
        }

        // Une suppression se propage, sinon l'autre carnet ressusciterait
        // l'entrée.
        merged.deleted = left.deleted || right.deleted;

        merged.updatedAt = byDate >= 0 ? left.updatedAt : right.updatedAt;
        return merged;
    }

    public static Vault fromJson(String json) throws JSONException {
        JSONObject root = new JSONObject(json);
        if (root.getInt("schema") != SCHEMA) {
            throw new JSONException("Carnet en version " + root.getInt("schema")
                    + ", attendu " + SCHEMA);
        }
        Vault v = new Vault();
        v.updatedAt = root.optString("updatedAt", nowIso());
        JSONArray arr = root.getJSONArray("entries");
        for (int i = 0; i < arr.length(); i++) {
            v.entries.add(VaultEntry.fromJson(arr.getJSONObject(i)));
        }
        return v;
    }

    public String toJson() throws JSONException {
        JSONObject root = new JSONObject();
        root.put("schema", SCHEMA);
        root.put("updatedAt", updatedAt);
        JSONArray arr = new JSONArray();
        for (VaultEntry e : entries) arr.put(e.toJson());
        root.put("entries", arr);
        return root.toString(2);
    }

    public static Vault load(Context context) {
        File file = new File(context.getFilesDir(), FILENAME);
        if (!file.isFile()) return new Vault();
        try (java.io.FileInputStream in = new java.io.FileInputStream(file)) {
            // FileInputStream plutot que java.nio.file.Files, qui demande l'API 26.
            java.io.ByteArrayOutputStream buf = new java.io.ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) buf.write(chunk, 0, n);
            return fromJson(new String(buf.toByteArray(), StandardCharsets.UTF_8));
        } catch (IOException | JSONException e) {
            Log.e(TAG, "Carnet illisible, on repart d'un carnet vide", e);
            return new Vault();
        }
    }

    public void save(Context context) {
        File file = new File(context.getFilesDir(), FILENAME);
        File tmp = new File(context.getFilesDir(), FILENAME + ".tmp");
        updatedAt = nowIso();
        try {
            // Écriture atomique : une interruption ne doit pas laisser un
            // carnet tronqué, qui ferait perdre toutes les entrées.
            try (java.io.FileOutputStream out = new java.io.FileOutputStream(tmp)) {
                out.write(toJson().getBytes(StandardCharsets.UTF_8));
            }
            if (!tmp.renameTo(file)) {
                Log.e(TAG, "Echec du remplacement du carnet");
            }
        } catch (IOException | JSONException e) {
            Log.e(TAG, "Echec de l'ecriture du carnet", e);
        }
    }
}
