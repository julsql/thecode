package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONException;
import org.json.JSONObject;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Locale;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Réglages par défaut : longueur et jeux de caractères pour un site absent du
 * carnet. Partagés chiffrés avec le compte : shared/spec/default-settings.md.
 */
public final class DefaultSettings {

    public static final int MIN_LENGTH = 4;
    public static final int MAX_LENGTH = 40;
    public static final int DEFAULT_LENGTH = 20;
    /** Jamais modifiés localement : toute valeur distante l'emporte. */
    public static final String NEVER = "1970-01-01T00:00:00Z";

    private static final Pattern ISO =
            Pattern.compile("^(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2})(\\.(\\d+))?Z$");

    public final int length;
    public final boolean lower;
    public final boolean upper;
    public final boolean symbols;
    public final boolean numbers;
    @NonNull
    public final String updatedAt;

    public DefaultSettings(int length, boolean lower, boolean upper, boolean symbols,
                           boolean numbers, @NonNull String updatedAt) {
        this.length = length;
        this.lower = lower;
        this.upper = upper;
        this.symbols = symbols;
        this.numbers = numbers;
        this.updatedAt = updatedAt;
    }

    @NonNull
    public JSONObject toJson() throws JSONException {
        return new JSONObject()
                .put("length", length)
                .put("charset", new JSONObject()
                        .put("lower", lower)
                        .put("upper", upper)
                        .put("symbols", symbols)
                        .put("numbers", numbers))
                .put("updatedAt", updatedAt);
    }

    /** Lit un blob déchiffré ; lève si hors bornes ou sans aucun jeu coché. */
    @NonNull
    public static DefaultSettings fromJson(@NonNull JSONObject o) throws JSONException {
        JSONObject charset = o.getJSONObject("charset");
        DefaultSettings s = new DefaultSettings(o.getInt("length"),
                charset.getBoolean("lower"), charset.getBoolean("upper"),
                charset.getBoolean("symbols"), charset.getBoolean("numbers"),
                o.getString("updatedAt"));
        if (s.length < MIN_LENGTH || s.length > MAX_LENGTH) {
            throw new JSONException("Longueur hors bornes : " + s.length);
        }
        if (!(s.lower || s.upper || s.symbols || s.numbers)) {
            throw new JSONException("Aucun jeu de caractères");
        }
        if (epochMillis(s.updatedAt) == null) {
            throw new JSONException("Date illisible : " + s.updatedAt);
        }
        return s;
    }

    /** La plus récente des deux ; à égalité, la distante. */
    @NonNull
    public static DefaultSettings newest(@NonNull DefaultSettings local,
                                         @NonNull DefaultSettings remote) {
        return millis(local.updatedAt) > millis(remote.updatedAt) ? local : remote;
    }

    public boolean sameValues(@NonNull DefaultSettings other) {
        return length == other.length && lower == other.lower && upper == other.upper
                && symbols == other.symbols && numbers == other.numbers;
    }

    private static long millis(String iso) {
        Long ms = epochMillis(iso);
        return ms == null ? Long.MIN_VALUE : ms;
    }

    /**
     * ISO 8601 en UTC, avec ou sans fraction de seconde : les clients n'écrivent
     * pas tous la même précision, une comparaison de chaînes se tromperait.
     */
    @Nullable
    static Long epochMillis(@Nullable String iso) {
        if (iso == null) return null;
        Matcher m = ISO.matcher(iso);
        if (!m.matches()) return null;
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT);
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        fmt.setLenient(false);
        try {
            long ms = fmt.parse(m.group(1)).getTime();
            String fraction = m.group(3);
            if (fraction != null) {
                ms += Long.parseLong((fraction + "00").substring(0, 3));
            }
            return ms;
        } catch (ParseException e) {
            return null;
        }
    }
}
