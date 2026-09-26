package fr.juliette.thecode;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import java.security.GeneralSecurityException;
import java.io.IOException;

import fr.juliette.thecode.vault.DefaultSettings;
import fr.juliette.thecode.vault.Sync;
import fr.juliette.thecode.vault.Vault;
import fr.juliette.thecode.vault.VaultLock;

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
    public static final String KEY_SETTINGS_UPDATED_AT = "settingsUpdatedAt";
    public static final String KEY_DARK_MODE = "darkMode";
    public static final String KEY_LAST_UNLOCK_AT = "lastUnlockAt";
    public static final String KEY_V2_NOTICE_SEEN = "v2NoticeSeen";
    public static final String KEY_SYNC_ENDPOINT = "syncEndpoint";
    public static final String KEY_SYNC_ACCESS = "syncAccessToken";
    public static final String KEY_SYNC_REFRESH = "syncRefreshToken";
    public static final String KEY_SYNC_PLAN = "syncPlan";
    public static final String KEY_VAULT_LOCK_METHOD = "vaultLockMethod";
    public static final String KEY_VAULT_LOCK_PASSWORD = "vaultLockPassword";

    private static final String TAG = "TheCode";
    /** Fichier chiffré, distinct de l'ancien pour permettre la migration. */
    private static final String SECURE_FILE = "thecode.secure.prefs";

    private final SharedPreferences prefs;
    /**
     * Préférences chiffrées, adossées au Keystore matériel.
     *
     * La clef maîtresse y vit seule : elle ouvre tous les comptes, et la
     * stocker en clair contredisait ce que le README promettait. Les réglages
     * ordinaires restent dans le fichier habituel, ils n'ont rien de sensible.
     */
    private final SharedPreferences securePrefs;

    public Preferences(Context context) {
        Context app = context.getApplicationContext();
        this.prefs = app.getSharedPreferences(FILE, Context.MODE_PRIVATE);
        this.securePrefs = openSecure(app);
        migrateEncodingKey();
    }

    private static SharedPreferences openSecure(Context app) {
        try {
            MasterKey masterKey = new MasterKey.Builder(app)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();
            return EncryptedSharedPreferences.create(
                    app,
                    SECURE_FILE,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM);
        } catch (GeneralSecurityException | IOException e) {
            // Keystore indisponible : plutôt que d'écrire la clef en clair sans
            // le dire, on ne la persiste pas du tout. L'utilisateur la
            // ressaisira, ce qui est préférable à une fausse promesse.
            Log.e(TAG, "Stockage chiffré indisponible : la clef ne sera pas conservée", e);
            return null;
        }
    }

    /** Déplace une clef écrite en clair par une version antérieure. */
    private void migrateEncodingKey() {
        String legacy = prefs.getString(KEY_ENCODING_KEY, "");
        if (legacy.isEmpty()) return;

        if (securePrefs != null) {
            securePrefs.edit().putString(KEY_ENCODING_KEY, legacy).apply();
        }
        // Retirée dans tous les cas : la laisser en clair serait pire que de
        // demander une ressaisie.
        prefs.edit().remove(KEY_ENCODING_KEY).apply();
        Log.i(TAG, "Clef maîtresse déplacée vers le stockage chiffré");
    }

    /** Vrai si la clef peut être conservée entre deux lancements. */
    public boolean isSecureStorageAvailable() {
        return securePrefs != null;
    }

    public String getEncodingKey() {
        return securePrefs == null ? "" : securePrefs.getString(KEY_ENCODING_KEY, "");
    }

    public void setEncodingKey(String v) {
        if (securePrefs == null) return;
        securePrefs.edit().putString(KEY_ENCODING_KEY, v).apply();
    }

    /*
     * Réglages par défaut. Chaque vraie modification date les réglages
     * ({@link #KEY_SETTINGS_UPDATED_AT}) : c'est ce qui départage deux
     * appareils. Réécrire la même valeur (rechargement de l'écran) ne date rien.
     */

    public int getLength() { return prefs.getInt(KEY_LENGTH, Code.DEFAULT_LENGTH); }
    public void setLength(int v) { if (v != getLength()) changed(touch().putInt(KEY_LENGTH, v)); }

    public boolean getMinState() { return prefs.getBoolean(KEY_MIN, true); }
    public void setMinState(boolean v) { if (v != getMinState()) changed(touch().putBoolean(KEY_MIN, v)); }

    public boolean getMajState() { return prefs.getBoolean(KEY_MAJ, true); }
    public void setMajState(boolean v) { if (v != getMajState()) changed(touch().putBoolean(KEY_MAJ, v)); }

    public boolean getSymState() { return prefs.getBoolean(KEY_SYM, true); }
    public void setSymState(boolean v) { if (v != getSymState()) changed(touch().putBoolean(KEY_SYM, v)); }

    public boolean getChiState() { return prefs.getBoolean(KEY_CHI, true); }
    public void setChiState(boolean v) { if (v != getChiState()) changed(touch().putBoolean(KEY_CHI, v)); }

    /** Prévenu à chaque vraie modification d'un réglage par défaut. */
    public interface SettingsListener {
        void onDefaultSettingsChanged();
    }

    @Nullable
    private static volatile SettingsListener settingsListener;

    public static void setSettingsListener(@Nullable SettingsListener listener) {
        settingsListener = listener;
    }

    /**
     * Enregistre puis relance la synchronisation. Pas les réglages reçus par
     * {@link #applyDefaultSettings} : ils viennent justement d'elle.
     */
    private static void changed(SharedPreferences.Editor editor) {
        editor.apply();
        SettingsListener listener = settingsListener;
        if (listener != null) listener.onDefaultSettingsChanged();
    }

    /** Date de la dernière modification locale ; {@link DefaultSettings#NEVER} sinon. */
    @NonNull
    public String getSettingsUpdatedAt() {
        return prefs.getString(KEY_SETTINGS_UPDATED_AT, DefaultSettings.NEVER);
    }

    private SharedPreferences.Editor touch() {
        return prefs.edit().putString(KEY_SETTINGS_UPDATED_AT, Vault.nowIso());
    }

    @NonNull
    public DefaultSettings getDefaultSettings() {
        return new DefaultSettings(getLength(), getMinState(), getMajState(), getSymState(),
                getChiState(), getSettingsUpdatedAt());
    }

    /** Applique des réglages venus d'ailleurs, en gardant leur date. */
    public void applyDefaultSettings(@NonNull DefaultSettings s) {
        prefs.edit()
                .putInt(KEY_LENGTH, s.length)
                .putBoolean(KEY_MIN, s.lower)
                .putBoolean(KEY_MAJ, s.upper)
                .putBoolean(KEY_SYM, s.symbols)
                .putBoolean(KEY_CHI, s.numbers)
                .putString(KEY_SETTINGS_UPDATED_AT, s.updatedAt)
                .apply();
    }

    /** Vrai une fois l'annonce du passage a la v2 lue et fermee. */
    public boolean getV2NoticeSeen() { return prefs.getBoolean(KEY_V2_NOTICE_SEEN, false); }
    public void setV2NoticeSeen() { prefs.edit().putBoolean(KEY_V2_NOTICE_SEEN, true).apply(); }

    public String getDarkMode() { return prefs.getString(KEY_DARK_MODE, "SYSTEM"); }
    public void setDarkMode(String v) { prefs.edit().putString(KEY_DARK_MODE, v).apply(); }

    /**
     * Jetons de synchronisation.
     *
     * Dans le fichier chiffré, comme la clef maîtresse : ils ouvrent le compte
     * de synchronisation. Ils y sont stockés à part du carnet, et ne s'y
     * retrouvent jamais.
     *
     * Rend {@code null} tant qu'aucun compte n'est lié, ou si le stockage
     * chiffré est indisponible : plutôt que de les écrire en clair, on
     * redemandera la connexion.
     */
    @Nullable
    public Sync.Credentials getSyncCredentials() {
        if (securePrefs == null) return null;
        String endpoint = securePrefs.getString(KEY_SYNC_ENDPOINT, "");
        String access = securePrefs.getString(KEY_SYNC_ACCESS, "");
        String refresh = securePrefs.getString(KEY_SYNC_REFRESH, "");
        String plan = securePrefs.getString(KEY_SYNC_PLAN, Sync.PLAN_FREE);
        if (endpoint.isEmpty() || access.isEmpty() || refresh.isEmpty()) return null;
        return new Sync.Credentials(endpoint, access, refresh, plan);
    }

    public void setSyncCredentials(@NonNull Sync.Credentials credentials) {
        if (securePrefs == null) return;
        securePrefs.edit()
                .putString(KEY_SYNC_ENDPOINT, credentials.endpoint)
                .putString(KEY_SYNC_ACCESS, credentials.accessToken)
                .putString(KEY_SYNC_REFRESH, credentials.refreshToken)
                .putString(KEY_SYNC_PLAN, credentials.plan)
                .apply();
    }

    public void clearSyncCredentials() {
        if (securePrefs == null) return;
        securePrefs.edit()
                .remove(KEY_SYNC_ENDPOINT)
                .remove(KEY_SYNC_ACCESS)
                .remove(KEY_SYNC_REFRESH)
                .remove(KEY_SYNC_PLAN)
                .apply();
    }

    /**
     * Verrou de l'écran carnet : méthode choisie et empreinte du mot de passe.
     *
     * Dans le fichier chiffré quand le Keystore est là, sinon dans le fichier
     * ordinaire : l'empreinte n'est pas le mot de passe, et sans elle l'écran
     * ne pourrait pas être verrouillé du tout. Jamais synchronisé.
     */
    @NonNull
    public VaultLock.Store vaultLockStore() {
        final SharedPreferences store = securePrefs != null ? securePrefs : prefs;
        return new VaultLock.Store() {
            @NonNull
            @Override
            public String method() {
                return store.getString(KEY_VAULT_LOCK_METHOD, "");
            }

            @Override
            public void setMethod(@NonNull String method) {
                store.edit().putString(KEY_VAULT_LOCK_METHOD, method).apply();
            }

            @Nullable
            @Override
            public String passwordRecord() {
                return store.getString(KEY_VAULT_LOCK_PASSWORD, null);
            }

            @Override
            public void setPasswordRecord(@Nullable String record) {
                if (record == null) {
                    store.edit().remove(KEY_VAULT_LOCK_PASSWORD).apply();
                } else {
                    store.edit().putString(KEY_VAULT_LOCK_PASSWORD, record).apply();
                }
            }

            @Override
            public void clear() {
                store.edit()
                        .remove(KEY_VAULT_LOCK_METHOD)
                        .remove(KEY_VAULT_LOCK_PASSWORD)
                        .apply();
            }
        };
    }

    /** Horodatage (epoch ms) de la dernière session authentifiée. Cf. {@link SessionLock}. */
    public long getLastUnlockAt() { return prefs.getLong(KEY_LAST_UNLOCK_AT, 0L); }
    public void setLastUnlockAt(long v) { prefs.edit().putLong(KEY_LAST_UNLOCK_AT, v).apply(); }
    public void clearLastUnlockAt() { prefs.edit().remove(KEY_LAST_UNLOCK_AT).apply(); }
}
