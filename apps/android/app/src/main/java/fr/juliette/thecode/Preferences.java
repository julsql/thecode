package fr.juliette.thecode;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Stockage local des préférences utilisateur (clé secrète et options).
 * Aucune donnée n'est transmise vers un serveur.
 */
public final class Preferences {

    private static final String FILE = "thecode.prefs";

    public static final String KEY_ENCODING_KEY = "encodingKey";
    public static final String KEY_LENGTH = "lengthNumber";
    public static final String KEY_MIN = "minState";
    public static final String KEY_MAJ = "majState";
    public static final String KEY_SYM = "symState";
    public static final String KEY_CHI = "chiState";
    public static final String KEY_DARK_MODE = "darkMode";
    public static final String KEY_LAST_UNLOCK_AT = "lastUnlockAt";

    private final SharedPreferences prefs;

    public Preferences(Context context) {
        this.prefs = context.getApplicationContext()
                .getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    public String getEncodingKey() { return prefs.getString(KEY_ENCODING_KEY, ""); }
    public void setEncodingKey(String v) { prefs.edit().putString(KEY_ENCODING_KEY, v).apply(); }

    public int getLength() { return prefs.getInt(KEY_LENGTH, Code.DEFAULT_LENGTH); }
    public void setLength(int v) { prefs.edit().putInt(KEY_LENGTH, v).apply(); }

    public boolean getMinState() { return prefs.getBoolean(KEY_MIN, true); }
    public void setMinState(boolean v) { prefs.edit().putBoolean(KEY_MIN, v).apply(); }

    public boolean getMajState() { return prefs.getBoolean(KEY_MAJ, true); }
    public void setMajState(boolean v) { prefs.edit().putBoolean(KEY_MAJ, v).apply(); }

    public boolean getSymState() { return prefs.getBoolean(KEY_SYM, true); }
    public void setSymState(boolean v) { prefs.edit().putBoolean(KEY_SYM, v).apply(); }

    public boolean getChiState() { return prefs.getBoolean(KEY_CHI, true); }
    public void setChiState(boolean v) { prefs.edit().putBoolean(KEY_CHI, v).apply(); }

    public String getDarkMode() { return prefs.getString(KEY_DARK_MODE, "SYSTEM"); }
    public void setDarkMode(String v) { prefs.edit().putString(KEY_DARK_MODE, v).apply(); }

    /** Horodatage (epoch ms) de la dernière session authentifiée. Cf. {@link SessionLock}. */
    public long getLastUnlockAt() { return prefs.getLong(KEY_LAST_UNLOCK_AT, 0L); }
    public void setLastUnlockAt(long v) { prefs.edit().putLong(KEY_LAST_UNLOCK_AT, v).apply(); }
    public void clearLastUnlockAt() { prefs.edit().remove(KEY_LAST_UNLOCK_AT).apply(); }
}
