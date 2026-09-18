package fr.juliette.thecode;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import fr.juliette.thecode.vault.Sync;
import fr.juliette.thecode.vault.Vault;
import fr.juliette.thecode.vault.VaultEntry;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Écran du carnet.
 *
 * Le carnet ne contient aucun mot de passe : seulement de quoi rejouer une
 * dérivation. Cet écran sert à voir ce qui est enregistré et à retrouver quels
 * réglages s'appliquent à quel site — c'était précisément ce qu'on ne pouvait
 * plus savoir avant qu'il existe.
 */
public class VaultActivity extends AppCompatActivity {

    /**
     * Un seul fil, et il n'est pas celui de l'interface : PBKDF2 à 600 000
     * itérations plus un aller-retour réseau gèleraient l'écran, et Android
     * interdit de toute façon le réseau sur le fil principal.
     */
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    private Preferences preferences;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_vault);

        preferences = new Preferences(this);

        MaterialToolbar toolbar = findViewById(R.id.vaultToolbar);
        toolbar.setNavigationOnClickListener(v -> finish());
        toolbar.inflateMenu(R.menu.menu_vault);
        toolbar.setOnMenuItemClickListener(this::onMenuItem);

        render(Vault.load(this));
    }

    @Override
    protected void onDestroy() {
        worker.shutdownNow();
        super.onDestroy();
    }

    // ------------------------------------------------------- synchronisation

    private boolean onMenuItem(MenuItem item) {
        int id = item.getItemId();
        if (id == R.id.action_sync) {
            startSync();
            return true;
        }
        if (id == R.id.action_sync_unlink) {
            unlink();
            return true;
        }
        return false;
    }

    private void startSync() {
        // La clef maîtresse chiffre le carnet avant l'envoi : sans elle, il
        // n'y a rien à synchroniser, et surtout rien à déchiffrer au retour.
        String masterKey = preferences.getEncodingKey();
        if (masterKey.isEmpty()) {
            toast(getString(R.string.sync_needs_key));
            return;
        }
        if (!preferences.isSecureStorageAvailable()) {
            toast(getString(R.string.sync_no_secure_storage));
            return;
        }

        Sync.Credentials credentials = preferences.getSyncCredentials();
        if (credentials == null) {
            askForCredentials(masterKey);
        } else {
            runSync(masterKey, credentials);
        }
    }

    private void askForCredentials(String masterKey) {
        View form = LayoutInflater.from(this).inflate(R.layout.dialog_sync, null);
        EditText endpoint = form.findViewById(R.id.syncEndpoint);
        EditText email = form.findViewById(R.id.syncEmail);
        EditText password = form.findViewById(R.id.syncPassword);
        endpoint.setText(Sync.DEFAULT_ENDPOINT);

        new MaterialAlertDialogBuilder(this)
                .setTitle(R.string.sync_title)
                .setView(form)
                .setNegativeButton(android.R.string.cancel, null)
                .setPositiveButton(R.string.sync_connect, (dialog, which) -> signInThenSync(
                        masterKey,
                        endpoint.getText().toString().trim(),
                        email.getText().toString().trim(),
                        password.getText().toString()))
                .show();
    }

    private void signInThenSync(String masterKey, String endpoint, String email, String password) {
        toast(getString(R.string.sync_running));
        worker.execute(() -> {
            try {
                Sync sync = new Sync();
                Sync.Credentials credentials =
                        sync.login(endpoint, email, password, android.os.Build.MODEL);
                main.post(() -> {
                    preferences.setSyncCredentials(credentials);
                    runSync(masterKey, credentials);
                });
            } catch (Sync.SyncException e) {
                main.post(() -> toast(getString(R.string.sync_failed, e.getMessage())));
            }
        });
    }

    private void runSync(String masterKey, Sync.Credentials credentials) {
        toast(getString(R.string.sync_running));
        worker.execute(() -> {
            try {
                Sync sync = new Sync();
                Sync.Result result = sync.syncRenewing(Vault.load(this), masterKey, credentials);
                main.post(() -> {
                    // Les jetons peuvent avoir été renouvelés pendant l'appel :
                    // ne pas les réenregistrer forcerait une reconnexion.
                    preferences.setSyncCredentials(result.credentials);
                    result.vault.save(this);
                    render(result.vault);

                    int kept = 0;
                    for (VaultEntry entry : result.vault.entries) {
                        if (!entry.deleted) kept++;
                    }
                    toast(result.conflicts.isEmpty()
                            ? getString(R.string.sync_done, kept)
                            : getString(R.string.sync_done_conflicts, kept,
                                    result.conflicts.size()));
                });
            } catch (Sync.SyncException e) {
                main.post(() -> toast(getString(R.string.sync_failed, e.getMessage())));
            }
        });
    }

    private void unlink() {
        if (preferences.getSyncCredentials() == null) {
            toast(getString(R.string.sync_nothing_to_unlink));
            return;
        }
        // Le carnet local reste : délier coupe la synchronisation, cela
        // n'efface rien.
        preferences.clearSyncCredentials();
        toast(getString(R.string.sync_unlinked));
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    private void render(Vault vault) {
        LinearLayout list = findViewById(R.id.vaultList);
        View empty = findViewById(R.id.vaultEmpty);
        list.removeAllViews();

        List<VaultEntry> entries = new java.util.ArrayList<>();
        for (VaultEntry entry : vault.entries) {
            if (!entry.deleted) entries.add(entry);
        }
        // Collections.sort plutot que List#sort, qui demande l'API 24 alors
        // que minSdk vaut 21.
        java.util.Collections.sort(entries, (a, b) -> label(a).compareToIgnoreCase(label(b)));

        // Une liste vide sans explication laisse croire à une panne.
        empty.setVisibility(entries.isEmpty() ? View.VISIBLE : View.GONE);

        LayoutInflater inflater = LayoutInflater.from(this);
        for (VaultEntry entry : entries) {
            View card = inflater.inflate(R.layout.vault_item, list, false);

            ((TextView) card.findViewById(R.id.entryLabel)).setText(label(entry));
            // String.join demande l'API 26 : on assemble a la main.
            StringBuilder domains = new StringBuilder();
            for (String domain : entry.domains) {
                if (domains.length() > 0) domains.append(", ");
                domains.append(domain);
            }
            ((TextView) card.findViewById(R.id.entryDomains)).setText(domains.toString());
            ((TextView) card.findViewById(R.id.entrySettings)).setText(
                    getString(R.string.vault_entry_settings,
                            entry.length, charsetSummary(entry), entry.v));

            list.addView(card);
        }
    }

    private static String label(VaultEntry entry) {
        return entry.label != null && !entry.label.isEmpty() ? entry.label : entry.siteKey;
    }

    /** Résumé compact des jeux de caractères : aA#1. */
    private static String charsetSummary(VaultEntry entry) {
        StringBuilder out = new StringBuilder(4);
        if (entry.lower) out.append('a');
        if (entry.upper) out.append('A');
        if (entry.symbols) out.append('#');
        if (entry.numbers) out.append('1');
        return out.toString();
    }
}
