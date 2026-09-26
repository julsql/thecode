package fr.juliette.thecode;

import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
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
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.textfield.TextInputLayout;

import fr.juliette.thecode.vault.SiteResolution;
import fr.juliette.thecode.vault.Sync;
import fr.juliette.thecode.vault.Vault;
import fr.juliette.thecode.vault.VaultEntry;
import fr.juliette.thecode.vault.VaultLock;

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
    /** Synchronisation partagée : automatique, et forcée par le menu. */
    private AutoSync autoSync;
    /**
     * Verrou de l'écran (biométrie ou clef maîtresse) : partage la session de la
     * clef, ouverte 3 minutes après la sortie, même si l'activité est recréée
     * entre-temps.
     */
    private VaultLock lock;
    /**
     * Incrémenté à chaque reverrouillage : un calcul lancé avant que
     * l'écran soit quitté ne doit pas le rouvrir en revenant.
     */
    private int lockEpoch = 0;
    /** Dialogue en cours, fermé au reverrouillage pour ne rien laisser voir. */
    @Nullable
    private AlertDialog openDialog;
    /** Le carnet affiché : les actions le modifient et le réenregistrent. */
    private Vault vault = new Vault();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_vault);

        preferences = new Preferences(this);
        lock = new VaultLock(preferences::getEncodingKey, new SessionLock(preferences));
        autoSync = AutoSync.get(this);

        MaterialToolbar toolbar = findViewById(R.id.vaultToolbar);
        toolbar.setNavigationOnClickListener(v -> finish());
        toolbar.inflateMenu(R.menu.menu_vault);
        toolbar.setOnMenuItemClickListener(this::onMenuItem);

        findViewById(R.id.vaultUnlockAction).setOnClickListener(v -> promptUnlock());
        findViewById(R.id.vaultDeleteAccount).setOnClickListener(v -> startDeleteAccount());
    }

    @Override
    protected void onStart() {
        super.onStart();
        // Au-delà de la fenêtre de grâce, l'écran se referme et redemande l'auth.
        lock.onReturn();
        applyLockState();
        autoSync.addListener(syncListener);
        autoSync.onOpen();
    }

    @Override
    protected void onStop() {
        // Quitter l'écran fait courir la fenêtre de grâce (seul l'instant de
        // sortie est retenu). Le contenu est masqué quand même : la capture du
        // sélecteur d'applications ne doit rien montrer. onStart le réaffiche
        // si l'on revient à temps.
        autoSync.removeListener(syncListener);
        lock.onLeave();
        lockEpoch++;
        dismissOpenDialog();
        hideContent();
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        worker.shutdownNow();
        super.onDestroy();
    }

    // ---------------------------------------------------------------- verrou

    /**
     * Affiche le carnet si l'écran est déverrouillé, demande l'auth sinon.
     *
     * Le contenu n'est jamais rendu avant : une capture d'écran du sélecteur
     * d'applications suffirait à le révéler.
     */
    private void applyLockState() {
        if (lock.isUnlocked()) {
            findViewById(R.id.vaultLocked).setVisibility(View.GONE);
            render(Vault.load(this));
            return;
        }
        hideContent();
        if (!lock.isSystemAuthInProgress() && openDialog == null) promptUnlock();
    }

    private void hideContent() {
        ((LinearLayout) findViewById(R.id.vaultList)).removeAllViews();
        findViewById(R.id.vaultEmpty).setVisibility(View.GONE);
        findViewById(R.id.vaultSameKeyHint).setVisibility(View.GONE);
        findViewById(R.id.vaultSyncPitch).setVisibility(View.GONE);
        findViewById(R.id.vaultSyncStatus).setVisibility(View.GONE);
        findViewById(R.id.vaultAccountSection).setVisibility(View.GONE);
        findViewById(R.id.vaultLocked).setVisibility(View.VISIBLE);
    }

    /**
     * Biométrie quand l'appareil en propose, clef maîtresse sinon. Aucun
     * choix, aucune mise en place : il n'y a pas de secret propre au carnet.
     */
    private void promptUnlock() {
        if (lock.isUnlocked()) {
            applyLockState();
            return;
        }
        if (biometricAvailable()) {
            runBiometric(() -> {
                lock.unlockWithBiometrics();
                applyLockState();
            });
        } else if (lock.hasMasterKey()) {
            showKeyDialog();
        } else {
            showNeedsKey();
        }
    }

    /**
     * Biométrie forte, avec le code de l'appareil en repli comme le fait
     * l'OS. Le repli n'est combinable qu'à partir d'Android 11.
     */
    private static int biometricAuthenticators() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? BiometricManager.Authenticators.BIOMETRIC_STRONG
                        | BiometricManager.Authenticators.DEVICE_CREDENTIAL
                : BiometricManager.Authenticators.BIOMETRIC_STRONG;
    }

    private boolean biometricAvailable() {
        return BiometricManager.from(this).canAuthenticate(biometricAuthenticators())
                == BiometricManager.BIOMETRIC_SUCCESS;
    }

    private void runBiometric(Runnable onSuccess) {
        if (lock.isSystemAuthInProgress()) return;
        // Posé avant authenticate() : le repli sur le code de l'appareil
        // peut déclencher onStop avant tout rappel.
        lock.beginSystemAuth();
        BiometricPrompt prompt = new BiometricPrompt(this,
                ContextCompat.getMainExecutor(this),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(
                            @NonNull BiometricPrompt.AuthenticationResult result) {
                        lock.endSystemAuth(true);
                        onSuccess.run();
                    }

                    @Override
                    public void onAuthenticationError(int code, @NonNull CharSequence message) {
                        // L'écran reste verrouillé, avec de quoi réessayer. Si
                        // on l'a quitté pendant l'invite, la fenêtre de grâce
                        // tranche maintenant.
                        if (lock.endSystemAuth(false)) {
                            dismissOpenDialog();
                            // Écran encore en arrière-plan : onStart s'en chargera.
                            if (!isFinishing() && getLifecycle().getCurrentState()
                                    .isAtLeast(androidx.lifecycle.Lifecycle.State.STARTED)) {
                                applyLockState();
                            } else {
                                hideContent();
                            }
                        }
                    }
                });

        BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(getString(R.string.vault_locked_title))
                .setSubtitle(getString(R.string.vault_locked_subtitle))
                .setAllowedAuthenticators(biometricAuthenticators());
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            info.setNegativeButtonText(getString(android.R.string.cancel));
        }
        prompt.authenticate(info.build());
    }

    /**
     * Sans biométrie : ressaisir la clef maîtresse. Le bouton valide sans
     * fermer : une erreur s'affiche sous le champ, le dialogue ne se ferme
     * qu'au succès.
     */
    private void showKeyDialog() {
        View form = LayoutInflater.from(this).inflate(R.layout.dialog_vault_key, null);
        TextInputLayout keyLayout = form.findViewById(R.id.vaultKeyLayout);
        EditText key = form.findViewById(R.id.vaultKey);

        AlertDialog dialog = new MaterialAlertDialogBuilder(this)
                .setTitle(R.string.vault_lock_key_title)
                .setView(form)
                .setNegativeButton(android.R.string.cancel, null)
                .setPositiveButton(R.string.vault_unlock, null)
                .create();
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE)
                .setOnClickListener(v -> {
                    keyLayout.setError(null);
                    VaultLock.KeyCheck check = lock.unlockWithKey(key.getText().toString());
                    if (check == VaultLock.KeyCheck.MISMATCH) {
                        keyLayout.setError(getString(R.string.vault_lock_key_wrong));
                        return;
                    }
                    key.setText(null);
                    dialog.dismiss();
                    if (check == VaultLock.KeyCheck.NO_KEY) {
                        showNeedsKey();
                        return;
                    }
                    applyLockState();
                }));
        track(dialog);
        dialog.show();
    }

    /** Aucune clef enregistrée : c'est sur l'écran principal qu'on la définit. */
    private void showNeedsKey() {
        AlertDialog dialog = new MaterialAlertDialogBuilder(this)
                .setTitle(R.string.vault_locked_title)
                .setMessage(R.string.vault_lock_needs_key)
                .setPositiveButton(android.R.string.ok, (d, w) -> finish())
                .setOnCancelListener(d -> finish())
                .create();
        track(dialog);
        dialog.show();
    }

    private void track(AlertDialog dialog) {
        openDialog = dialog;
        dialog.setOnDismissListener(d -> {
            if (openDialog == dialog) openDialog = null;
        });
    }

    private void dismissOpenDialog() {
        if (openDialog != null) {
            AlertDialog dialog = openDialog;
            openDialog = null;
            // Fermer sans déclencher « annuler », qui quitterait l'écran.
            dialog.setOnCancelListener(null);
            dialog.dismiss();
        }
    }

    // ------------------------------------------------------- synchronisation

    private boolean onMenuItem(MenuItem item) {
        // Synchroniser ou transférer depuis un écran verrouillé contournerait
        // l'authentification.
        if (!lock.isUnlocked()) return true;

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
        if (id == R.id.action_vault_lock) {
            // Verrou explicite : efface la fenêtre de grâce. Pas d'invite
            // automatique, le bouton « Déverrouiller » reste à portée.
            lock.lock();
            lockEpoch++;
            dismissOpenDialog();
            hideContent();
            return true;
        }
        if (id == R.id.action_sync_unlink) {
            signOut();
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
            runSync();
        }
    }

    private void askForCredentials(String masterKey) {
        View form = LayoutInflater.from(this).inflate(R.layout.dialog_sync, null);
        EditText endpoint = form.findViewById(R.id.syncEndpoint);
        EditText email = form.findViewById(R.id.syncEmail);
        EditText password = form.findViewById(R.id.syncPassword);
        endpoint.setText(Sync.DEFAULT_ENDPOINT);

        AlertDialog dialog = new MaterialAlertDialogBuilder(this)
                .setTitle(R.string.sync_title)
                .setView(form)
                .setNegativeButton(android.R.string.cancel, null)
                .setPositiveButton(R.string.sync_connect, (d, which) -> signInThenSync(
                        masterKey,
                        endpoint.getText().toString().trim(),
                        email.getText().toString().trim(),
                        password.getText().toString()))
                .create();
        dialog.setOnDismissListener(d -> {
            if (openDialog == dialog) openDialog = null;
        });
        openDialog = dialog;
        dialog.show();

        View google = form.findViewById(R.id.syncGoogle);
        // Le client Google dépend du service : relu quand l'adresse change.
        String[] clientId = {null};
        Runnable refresh = () -> fetchGoogleClientId(
                endpoint.getText().toString().trim(), dialog, google, clientId);
        refresh.run();
        endpoint.setOnFocusChangeListener((v, hasFocus) -> {
            if (!hasFocus) refresh.run();
        });
        google.setOnClickListener(v -> {
            String id = clientId[0];
            if (id == null) return;
            String service = endpoint.getText().toString().trim();
            dialog.dismiss();
            googleSignInThenSync(masterKey, service, id);
        });
    }

    /**
     * Montre « Continuer avec Google » seulement si le service dit quel client
     * il accepte. Un échec le cache : la connexion par mot de passe reste.
     */
    private void fetchGoogleClientId(String endpoint, AlertDialog dialog, View button,
                                     String[] clientId) {
        clientId[0] = null;
        button.setVisibility(View.GONE);
        worker.execute(() -> {
            String id;
            try {
                id = new Sync().googleClientId(endpoint);
            } catch (Sync.SyncException e) {
                Log.w("TheCode", "Client Google introuvable sur " + endpoint, e);
                id = null;
            }
            String found = id;
            main.post(() -> {
                if (!dialog.isShowing()) return;
                clientId[0] = found;
                button.setVisibility(found == null ? View.GONE : View.VISIBLE);
            });
        });
    }

    /**
     * Credential Manager rend un jeton d'identité Google, que le service
     * échange contre les jetons du compte. La suite est celle du mot de passe.
     */
    private void googleSignInThenSync(String masterKey, String endpoint, String clientId) {
        GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(new GetSignInWithGoogleOption.Builder(clientId).build())
                .build();
        CredentialManager.create(this).getCredentialAsync(this, request,
                new CancellationSignal(), ContextCompat.getMainExecutor(this),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse response) {
                        String idToken = googleIdToken(response.getCredential());
                        if (idToken == null) {
                            toast(getString(R.string.sync_google_failed,
                                    getString(R.string.sync_google_unexpected)));
                            return;
                        }
                        exchangeGoogleToken(masterKey, endpoint, idToken);
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException e) {
                        // Fermer la fenêtre de Google est un choix, pas une erreur.
                        if (e instanceof GetCredentialCancellationException) return;
                        if (e instanceof NoCredentialException) {
                            toast(getString(R.string.sync_google_no_account));
                            return;
                        }
                        Log.w("TheCode", "Connexion Google impossible", e);
                        // getErrorMessage() et getType() sont réservées à la
                        // bibliothèque : getMessage() rend le même texte.
                        String detail = e.getMessage();
                        toast(getString(R.string.sync_google_failed, detail != null
                                ? detail : e.getClass().getSimpleName()));
                    }
                });
    }

    @Nullable
    private static String googleIdToken(Credential credential) {
        if (!(credential instanceof CustomCredential)
                || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                        .equals(credential.getType())) {
            return null;
        }
        try {
            return GoogleIdTokenCredential.createFrom(credential.getData()).getIdToken();
        } catch (Exception e) {
            // Kotlin ne déclare pas GoogleIdTokenParsingException : javac
            // refuse de l'attraper nommément.
            return null;
        }
    }

    private void exchangeGoogleToken(String masterKey, String endpoint, String idToken) {
        toast(getString(R.string.sync_running));
        String lang = Sync.serviceLang(java.util.Locale.getDefault().getLanguage());
        worker.execute(() -> {
            try {
                Sync.Credentials credentials = new Sync().googleSignIn(
                        endpoint, idToken, android.os.Build.MODEL, lang, "");
                main.post(() -> {
                    preferences.setSyncCredentials(credentials);
                    runSync();
                });
            } catch (Sync.SyncException e) {
                String message = e.status == 402
                        ? getString(R.string.sync_device_limit)
                        : getString(R.string.sync_google_failed, e.getMessage());
                main.post(() -> toast(message));
            }
        });
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
                    runSync();
                });
            } catch (Sync.SyncException e) {
                // 402 : plafond d'appareils. Le message du service nomme l'offre
                // et renvoie au site, ce qu'une app des magasins ne relaie pas :
                // on garde le fait, pas l'invitation.
                String message = e.status == 402
                        ? getString(R.string.sync_device_limit)
                        : getString(R.string.sync_failed, e.getMessage());
                main.post(() -> toast(message));
            }
        });
    }

    /**
     * Synchronisation forcée : la même routine que l'automatique
     * ({@link AutoSync}), qui ne double jamais une synchronisation en cours.
     * Seule celle-ci rend compte par un toast.
     */
    private void runSync() {
        toast(getString(R.string.sync_running));
        autoSync.syncNow();
    }

    private final AutoSync.Listener syncListener = new AutoSync.Listener() {
        @Override
        public void onSyncStatus(@NonNull String status) {
            renderSyncStatus();
        }

        @Override
        public void onSyncFinished(@NonNull AutoSync.Outcome outcome) {
            if (isFinishing()) return;
            // render() n'affiche rien si l'écran s'est reverrouillé.
            if (outcome.ok) render(Vault.load(VaultActivity.this));
            if (outcome.manual) toast(outcome.message);
        }
    };

    /** Dernier statut de synchronisation, seulement quand un compte est lié. */
    private void renderSyncStatus() {
        TextView view = findViewById(R.id.vaultSyncStatus);
        String status = autoSync.status();
        boolean show = lock.isUnlocked() && status != null
                && preferences.getSyncCredentials() != null;
        view.setVisibility(show ? View.VISIBLE : View.GONE);
        if (show) view.setText(status);
    }

    private void signOut() {
        Sync.Credentials credentials = preferences.getSyncCredentials();
        if (credentials == null) {
            toast(getString(R.string.sync_nothing_to_unlink));
            return;
        }
        // Le carnet local reste : se déconnecter coupe la synchronisation,
        // cela n'efface rien. La révocation passe par le réseau : un fil à
        // part, que la fermeture de l'écran (worker.shutdownNow) n'annule pas,
        // pour que la session locale soit toujours oubliée.
        new Thread(() -> new Sync().signOut(credentials, () -> {
            preferences.clearSyncCredentials();
            main.post(() -> {
                if (isFinishing()) return;
                toast(getString(R.string.sync_unlinked));
                render(vault);
            });
        }), "thecode-sign-out").start();
    }

    // ------------------------------------------------ suppression du compte

    /**
     * « Supprimer mon compte » : relit d'abord le compte (son adresse, et
     * s'il a un mot de passe), puis ouvre la confirmation.
     */
    private void startDeleteAccount() {
        if (!lock.isUnlocked()) return;
        Sync.Credentials credentials = preferences.getSyncCredentials();
        if (credentials == null) {
            toast(getString(R.string.sync_nothing_to_unlink));
            return;
        }
        toast(getString(R.string.account_delete_loading));
        int epoch = lockEpoch;
        worker.execute(() -> {
            try {
                Sync.AccountIdentity identity = new Sync().accountIdentity(credentials);
                main.post(() -> {
                    // Jetons renouvelés en chemin : sans eux, le prochain appel
                    // repartirait d'un jeton de renouvellement consommé.
                    if (preferences.getSyncCredentials() != null) {
                        preferences.setSyncCredentials(identity.credentials);
                    }
                    if (epoch != lockEpoch || isFinishing() || !lock.isUnlocked()) return;
                    showDeleteAccount(identity);
                });
            } catch (Sync.SyncException e) {
                main.post(() -> toast(
                        getString(R.string.account_delete_lookup_failed, e.getMessage())));
            }
        });
    }

    private void showDeleteAccount(Sync.AccountIdentity identity) {
        View form = LayoutInflater.from(this).inflate(R.layout.dialog_delete_account, null);
        TextView body = form.findViewById(R.id.deleteAccountBody);
        TextInputLayout emailLayout = form.findViewById(R.id.deleteAccountEmailLayout);
        TextInputLayout passwordLayout = form.findViewById(R.id.deleteAccountPasswordLayout);
        EditText email = form.findViewById(R.id.deleteAccountEmail);
        EditText password = form.findViewById(R.id.deleteAccountPassword);
        TextView error = form.findViewById(R.id.deleteAccountError);

        body.setText(getString(R.string.account_delete_body, identity.email));
        // Un compte Google ou Apple sans mot de passe n'a rien à saisir ici.
        passwordLayout.setVisibility(identity.hasPassword ? View.VISIBLE : View.GONE);

        AlertDialog dialog = new MaterialAlertDialogBuilder(this)
                .setTitle(R.string.account_delete_title)
                .setView(form)
                .setNegativeButton(android.R.string.cancel, null)
                .setPositiveButton(R.string.account_delete_confirm, null)
                .create();
        dialog.setOnShowListener(d -> {
            android.widget.Button ok = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
            ok.setTextColor(com.google.android.material.color.MaterialColors.getColor(
                    ok, com.google.android.material.R.attr.colorError));
            Runnable validate = () -> ok.setEnabled(
                    Sync.emailMatches(email.getText().toString(), identity.email)
                            && (!identity.hasPassword || password.length() > 0));
            android.text.TextWatcher watcher = new android.text.TextWatcher() {
                @Override
                public void beforeTextChanged(CharSequence s, int start, int count, int after) {
                }

                @Override
                public void onTextChanged(CharSequence s, int start, int before, int count) {
                }

                @Override
                public void afterTextChanged(android.text.Editable s) {
                    emailLayout.setError(null);
                    passwordLayout.setError(null);
                    validate.run();
                }
            };
            email.addTextChangedListener(watcher);
            password.addTextChangedListener(watcher);
            validate.run();

            ok.setOnClickListener(v -> {
                emailLayout.setError(null);
                passwordLayout.setError(null);
                error.setVisibility(View.GONE);
                ok.setEnabled(false);
                deleteAccount(dialog, ok, emailLayout, passwordLayout, error,
                        email.getText().toString(),
                        identity.hasPassword ? password.getText().toString() : "");
            });
        });
        track(dialog);
        dialog.show();
    }

    /**
     * Sur un fil à part, comme la déconnexion : quitter l'écran pendant
     * l'appel (worker.shutdownNow) ne doit pas laisser un compte supprimé
     * côté service et des jetons encore enregistrés ici.
     */
    private void deleteAccount(AlertDialog dialog, View ok, TextInputLayout emailLayout,
                               TextInputLayout passwordLayout, TextView error,
                               String typedEmail, String typedPassword) {
        Sync.Credentials credentials = preferences.getSyncCredentials();
        if (credentials == null) {
            dialog.dismiss();
            toast(getString(R.string.sync_nothing_to_unlink));
            return;
        }
        toast(getString(R.string.account_delete_running));
        new Thread(() -> {
            try {
                // Le carnet local reste : seule la session est oubliée, et
                // sans jetons la synchronisation automatique ne part plus.
                new Sync().deleteAccountAndForget(credentials, typedEmail, typedPassword,
                        preferences::clearSyncCredentials);
                main.post(() -> {
                    if (isFinishing()) return;
                    if (dialog.isShowing()) dialog.dismiss();
                    render(vault);
                    if (!lock.isUnlocked()) {
                        toast(getString(R.string.account_delete_done));
                        return;
                    }
                    AlertDialog done = new MaterialAlertDialogBuilder(this)
                            .setTitle(R.string.account_delete_done_title)
                            .setMessage(R.string.account_delete_done)
                            .setPositiveButton(android.R.string.ok, null)
                            .create();
                    track(done);
                    done.show();
                });
            } catch (Sync.SyncException e) {
                main.post(() -> {
                    if (isFinishing() || !dialog.isShowing()) {
                        toast(getString(R.string.account_delete_failed, e.getMessage()));
                        return;
                    }
                    ok.setEnabled(true);
                    switch (Sync.DeleteFailure.of(e)) {
                        case WRONG_PASSWORD:
                            passwordLayout.setError(
                                    getString(R.string.account_delete_wrong_password));
                            break;
                        case EMAIL_MISMATCH:
                            emailLayout.setError(getString(R.string.account_delete_email_mismatch));
                            break;
                        case UNREACHABLE:
                            error.setText(R.string.account_delete_unreachable);
                            error.setVisibility(View.VISIBLE);
                            break;
                        default:
                            error.setText(getString(R.string.account_delete_failed,
                                    e.getMessage()));
                            error.setVisibility(View.VISIBLE);
                    }
                });
            }
        }, "thecode-delete-account").start();
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    private void render(Vault vault) {
        this.vault = vault;
        // Une synchronisation qui se termine après le reverrouillage ne doit
        // rien afficher.
        if (!lock.isUnlocked()) return;
        LinearLayout list = findViewById(R.id.vaultList);
        findViewById(R.id.vaultSameKeyHint).setVisibility(View.VISIBLE);
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

        // La synchronisation est la principale raison de créer un compte, et
        // rien ne le disait tant qu'aucun n'était lié. Le bouton ouvre la
        // page de création sur le site ; il ne dit rien d'une offre payante,
        // ce que les règles des magasins d'applications interdisent.
        View pitch = findViewById(R.id.vaultSyncPitch);
        boolean linked = preferences.getSyncCredentials() != null;
        pitch.setVisibility(linked ? View.GONE : View.VISIBLE);
        findViewById(R.id.vaultAccountSection).setVisibility(linked ? View.VISIBLE : View.GONE);
        renderSyncStatus();
        if (!linked) {
            // Même connexion que le menu : un compte déjà créé se lie ici.
            findViewById(R.id.vaultSyncPitchSignIn).setOnClickListener(v -> startSync());
            findViewById(R.id.vaultSyncPitchAction).setOnClickListener(v -> startActivity(
                    new android.content.Intent(android.content.Intent.ACTION_VIEW,
                            android.net.Uri.parse(getString(R.string.sync_account_url)))));
        }

        LayoutInflater inflater = LayoutInflater.from(this);
        for (VaultEntry entry : entries) {
            View card = inflater.inflate(R.layout.vault_item, list, false);

            ((TextView) card.findViewById(R.id.entryLabel)).setText(label(entry));
            ((TextView) card.findViewById(R.id.entryLogin)).setText(loginOf(entry));
            ((TextView) card.findViewById(R.id.entryDomains)).setText(domainsOf(entry));
            ((TextView) card.findViewById(R.id.entrySettings)).setText(
                    getString(R.string.vault_entry_settings,
                            entry.length, charsetSummary(entry), entry.counter));

            com.google.android.material.button.MaterialButton action =
                    card.findViewById(R.id.entryAction);
            action.setText(R.string.vault_renew);
            // Jamais désactivé : un bouton éteint n'explique rien. Le clic
            // constate seulement que la fonction n'est pas activée sur ce
            // compte, sans renvoyer vers un achat hors du magasin.
            action.setOnClickListener(v -> proposeRenew(entry));

            card.setOnClickListener(v -> showDetail(entry));
            list.addView(card);
        }
    }

    // ------------------------------------------------------ renouvellement

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
    private void proposeRenew(VaultEntry entry) {
        String masterKey = preferences.getEncodingKey();
        if (masterKey.isEmpty()) {
            toast(getString(R.string.vault_needs_key));
            return;
        }
        if (!renewAllowed()) {
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
            preview.counter = entry.counter + 1;
            String after = Generator.generate(SiteResolution.of(preview), masterKey, null);

            main.post(() -> {
                // Écran reverrouillé pendant le calcul : ne rien montrer.
                if (!lock.isUnlocked() || isFinishing()) return;
                AlertDialog dialog = new MaterialAlertDialogBuilder(this)
                        .setTitle(getString(R.string.vault_renew_title, label))
                        .setMessage(getString(R.string.vault_password_pair, before, after))
                        .setNegativeButton(android.R.string.cancel, null)
                        .setPositiveButton(android.R.string.ok,
                                (d, which) -> applyRenew(entry, label))
                        .create();
                track(dialog);
                dialog.show();
            });
        });
    }

    private void applyRenew(VaultEntry entry, String label) {
        entry.counter += 1;
        // Sans réhorodatage, la fusion ferait gagner l'autre appareil et le
        // changement serait perdu à la synchronisation suivante.
        entry.updatedAt = Vault.nowIso();
        vault.save(this);

        render(vault);
        toast(getString(R.string.vault_renew_done, label, entry.counter));
    }

    // ------------------------------------------------------------- gestion

    /** Détail d'une entrée : tout ce qui rejoue la dérivation, plus les actions. */
    private void showDetail(VaultEntry entry) {
        String label = label(entry);
        AlertDialog dialog = new MaterialAlertDialogBuilder(this)
                .setTitle(label)
                .setMessage(getString(R.string.vault_detail,
                        entry.siteKey, domainsOf(entry), loginOf(entry), entry.length,
                        charsetSummary(entry), entry.counter,
                        entry.updatedAt == null ? "" : entry.updatedAt))
                .setPositiveButton(R.string.vault_renew, (d, w) -> proposeRenew(entry))
                .setNegativeButton(R.string.vault_delete, (d, w) -> confirmDelete(entry, label))
                .setNeutralButton(R.string.vault_close, null)
                .create();
        track(dialog);
        dialog.show();
    }

    private void confirmDelete(VaultEntry entry, String label) {
        AlertDialog dialog = new MaterialAlertDialogBuilder(this)
                .setTitle(getString(R.string.vault_delete_title, label))
                .setMessage(R.string.vault_delete_body)
                .setNegativeButton(android.R.string.cancel, null)
                .setPositiveButton(R.string.vault_delete, (d, w) -> {
                    if (!lock.isUnlocked()) return;
                    // Pierre tombale et non retrait : la suppression doit se
                    // propager à la synchronisation.
                    if (vault.delete(entry.id)) vault.save(this);
                    render(vault);
                    toast(getString(R.string.vault_delete_done, label));
                })
                .create();
        track(dialog);
        dialog.show();
    }

    private String loginOf(VaultEntry entry) {
        return entry.login == null || entry.login.isEmpty()
                ? getString(R.string.vault_entry_login_none) : entry.login;
    }

    /** String.join demande l'API 26 : on assemble à la main. */
    private static String domainsOf(VaultEntry entry) {
        StringBuilder domains = new StringBuilder();
        for (String domain : entry.domains) {
            if (domains.length() > 0) domains.append(", ");
            domains.append(domain);
        }
        return domains.toString();
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
