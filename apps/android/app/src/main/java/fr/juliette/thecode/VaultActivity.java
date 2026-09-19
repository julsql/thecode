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

import android.os.Build;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

import fr.juliette.thecode.vault.SiteResolution;
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
    private SessionLock sessionLock;
    /** Vrai une fois la session authentifiée : rien n'est rendu avant. */
    private boolean unlocked = false;
    private boolean authInFlight = false;
    /** Le carnet affiché : les actions le modifient et le réenregistrent. */
    private Vault vault = new Vault();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_vault);

        preferences = new Preferences(this);
        sessionLock = new SessionLock(preferences);

        MaterialToolbar toolbar = findViewById(R.id.vaultToolbar);
        toolbar.setNavigationOnClickListener(v -> finish());
        toolbar.inflateMenu(R.menu.menu_vault);
        toolbar.setOnMenuItemClickListener(this::onMenuItem);

        // Rien n'est affiché avant l'authentification : le carnet dit sur
        // quels sites on a un compte et sous quel identifiant. C'est aussi
        // sensible qu'un coffre de mots de passe.
        applyLockState();
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyLockState();
    }

    @Override
    protected void onPause() {
        // La fenêtre de grâce court à partir de la mise en arrière-plan, comme
        // pour la clef : revenir tout de suite ne redemande pas l'auth.
        if (unlocked) sessionLock.stamp();
        super.onPause();
    }

    /**
     * Affiche le carnet si la session est valide, demande l'auth sinon.
     *
     * Le contenu n'est jamais rendu avant : une capture d'écran du sélecteur
     * d'applications suffirait à le révéler.
     */
    private void applyLockState() {
        if (sessionLock.isValid()) {
            unlocked = true;
            findViewById(R.id.vaultLocked).setVisibility(View.GONE);
            render(Vault.load(this));
            return;
        }

        unlocked = false;
        ((LinearLayout) findViewById(R.id.vaultList)).removeAllViews();
        findViewById(R.id.vaultEmpty).setVisibility(View.GONE);
        findViewById(R.id.vaultLocked).setVisibility(View.VISIBLE);
        promptUnlock();
    }

    /**
     * Demande l'authentification de l'appareil.
     *
     * Sans matériel d'auth disponible — rare — on considère le terminal déjà
     * déverrouillé : refuser l'accès rendrait le carnet inutilisable sur un
     * appareil sans code.
     */
    private void promptUnlock() {
        if (authInFlight) return;

        int authenticators = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
                ? (BiometricManager.Authenticators.BIOMETRIC_WEAK
                    | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                : BiometricManager.Authenticators.BIOMETRIC_WEAK;

        BiometricManager manager = BiometricManager.from(this);
        if (manager.canAuthenticate(authenticators) != BiometricManager.BIOMETRIC_SUCCESS) {
            sessionLock.stamp();
            applyLockState();
            return;
        }

        authInFlight = true;
        BiometricPrompt prompt = new BiometricPrompt(this,
                ContextCompat.getMainExecutor(this),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(
                            @NonNull BiometricPrompt.AuthenticationResult result) {
                        authInFlight = false;
                        sessionLock.stamp();
                        applyLockState();
                    }

                    @Override
                    public void onAuthenticationError(int code, @NonNull CharSequence message) {
                        authInFlight = false;
                        // Refuser l'auth ferme l'écran : rester dessus laisserait
                        // croire que le carnet est vide.
                        finish();
                    }
                });

        BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(getString(R.string.vault_locked_title))
                .setSubtitle(getString(R.string.vault_locked_subtitle))
                .setAllowedAuthenticators(authenticators);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            info.setNegativeButtonText(getString(android.R.string.cancel));
        }
        prompt.authenticate(info.build());
    }

    @Override
    protected void onDestroy() {
        worker.shutdownNow();
        super.onDestroy();
    }

    // ------------------------------------------------------- synchronisation

    private boolean onMenuItem(MenuItem item) {
        // Synchroniser ou transférer depuis un écran verrouillé contournerait
        // l'authentification.
        if (!unlocked) return true;

        int id = item.getItemId();
        if (id == R.id.action_transfer) {
            // Le QR transporte le carnet sans serveur : c'est l'option qui
            // rend la synchronisation facultative.
            startActivity(new android.content.Intent(this,
                    fr.juliette.thecode.transfer.TransferActivity.class));
            return true;
        }
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
                // Un abonnement pris entre-temps doit se voir sans se
                // reconnecter ; un abonnement arrêté aussi.
                Sync.Credentials withPlan = sync.accountPlan(result.credentials);
                // Écriture disque ici et non sur le fil principal : la
                // synchronisation peut rapporter des centaines d'entrées.
                result.vault.save(this);

                main.post(() -> {
                    // Les jetons peuvent avoir été renouvelés pendant l'appel :
                    // ne pas les réenregistrer forcerait une reconnexion.
                    preferences.setSyncCredentials(withPlan);
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
        this.vault = vault;
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
                            entry.length, charsetSummary(entry), entry.v, entry.counter));

            // Le libelle dit l'action : une entree v1 n'a que la migration, le
            // compteur n'entrant pas dans sa derivation.
            boolean isV2 = entry.v >= 2;
            com.google.android.material.button.MaterialButton action =
                    card.findViewById(R.id.entryAction);
            action.setText(isV2 ? R.string.vault_renew : R.string.vault_migrate);
            // Le compteur — changer de mot de passe sans changer de clef — fait
            // partie de l'offre complète. La migration v1 vers v2 reste ouverte
            // à tous : c'est une mise à niveau, pas un service.
            action.setEnabled(!isV2 || renewAllowed());
            action.setOnClickListener(v -> proposeChange(entry, isV2));

            card.setOnClickListener(v -> proposeChange(entry, isV2));
            list.addView(card);
        }
    }

    // --------------------------------------------- renouvellement et migration

    /**
     * Le renouvellement demande l'offre complète.
     *
     * Décidé sur l'appareil, forcément : le compteur voyage à l'intérieur du
     * bloc chiffré, le serveur ne le voit pas et ne peut donc rien en dire.
     * L'offre connue est celle de la dernière synchronisation.
     */
    private boolean renewAllowed() {
        Sync.Credentials credentials = preferences.getSyncCredentials();
        return credentials != null && Sync.isPaidPlan(credentials.plan);
    }


    /**
     * Affiche l'ancien et le nouveau mot de passe, puis n'écrit qu'après
     * confirmation.
     *
     * Écrire d'abord rendrait le compte inaccessible : l'ancien mot de passe
     * est encore celui du site tant qu'il n'y a pas été changé.
     */
    private void proposeChange(VaultEntry entry, boolean renew) {
        String masterKey = preferences.getEncodingKey();
        if (masterKey.isEmpty()) {
            toast(getString(R.string.vault_needs_key));
            return;
        }
        if (renew && !renewAllowed()) {
            toast(getString(R.string.vault_renew_paid));
            return;
        }

        String label = label(entry);
        toast(getString(R.string.vault_working));

        // PBKDF2 à 600 000 itérations, deux fois : jamais sur le fil qui
        // dessine l'écran.
        worker.execute(() -> {
            SiteResolution current = SiteResolution.byId(vault, entry.id, entry.siteKey,
                    entry.length, entry.lower, entry.upper, entry.symbols, entry.numbers);
            String before = Generator.generate(current, masterKey, null);

            VaultEntry preview = VaultEntry.copyOf(entry);
            if (renew) {
                preview.counter = entry.counter + 1;
            } else {
                preview.v = 2;
            }
            String after = Generator.generate(SiteResolution.of(preview), masterKey, null);

            main.post(() -> new MaterialAlertDialogBuilder(this)
                    .setTitle(getString(renew ? R.string.vault_renew_title
                            : R.string.vault_migrate_title, label))
                    .setMessage(getString(R.string.vault_password_pair, before, after))
                    .setNegativeButton(android.R.string.cancel, null)
                    .setPositiveButton(android.R.string.ok,
                            (dialog, which) -> applyChange(entry, renew, label))
                    .show());
        });
    }

    private void applyChange(VaultEntry entry, boolean renew, String label) {
        if (renew) {
            entry.counter += 1;
        } else {
            entry.v = 2;
        }
        // Sans réhorodatage, la fusion ferait gagner l'autre appareil et le
        // changement serait perdu à la synchronisation suivante.
        entry.updatedAt = Vault.nowIso();
        vault.save(this);

        render(vault);
        toast(renew
                ? getString(R.string.vault_renew_done, label, entry.counter)
                : getString(R.string.vault_migrate_done, label));
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
