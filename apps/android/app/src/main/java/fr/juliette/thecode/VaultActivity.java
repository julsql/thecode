package fr.juliette.thecode;

import android.app.KeyguardManager;
import android.content.Intent;
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

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
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
import fr.juliette.thecode.vault.VaultPassword;

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
     * Verrou de l'écran (shared/spec/vault-lock.md) : partage la session de la
     * clef, ouverte 3 minutes après la sortie, même si l'activité est recréée
     * entre-temps.
     */
    private VaultLock lock;
    /**
     * Incrémenté à chaque reverrouillage : un calcul PBKDF2 lancé avant que
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
        lock = new VaultLock(preferences.vaultLockStore(), new SessionLock(preferences));
        autoSync = AutoSync.get(this);

        MaterialToolbar toolbar = findViewById(R.id.vaultToolbar);
        toolbar.setNavigationOnClickListener(v -> finish());
        toolbar.inflateMenu(R.menu.menu_vault);
        toolbar.setOnMenuItemClickListener(this::onMenuItem);

        findViewById(R.id.vaultUnlockAction).setOnClickListener(v -> promptUnlock());
        findViewById(R.id.vaultForgotAction).setOnClickListener(v -> confirmForget());
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
        switch (lock.state()) {
            case UNLOCKED:
                findViewById(R.id.vaultLocked).setVisibility(View.GONE);
                render(Vault.load(this));
                return;
            case LOCKED:
                hideContent();
                findViewById(R.id.vaultForgotAction).setVisibility(View.VISIBLE);
                if (!lock.isSystemAuthInProgress() && openDialog == null) promptUnlock();
                return;
            case SETUP:
            default:
                hideContent();
                findViewById(R.id.vaultForgotAction).setVisibility(View.GONE);
                if (!lock.isSystemAuthInProgress() && openDialog == null) startSetup();
        }
    }

    private void hideContent() {
        ((LinearLayout) findViewById(R.id.vaultList)).removeAllViews();
        findViewById(R.id.vaultEmpty).setVisibility(View.GONE);
        findViewById(R.id.vaultSyncPitch).setVisibility(View.GONE);
        findViewById(R.id.vaultSyncStatus).setVisibility(View.GONE);
        findViewById(R.id.vaultLocked).setVisibility(View.VISIBLE);
    }

    private void promptUnlock() {
        switch (lock.state()) {
            case SETUP:
                startSetup();
                return;
            case UNLOCKED:
                applyLockState();
                return;
            default:
        }
        if (lock.method() == VaultLock.Method.BIOMETRIC) {
            if (!biometricAvailable()) {
                toast(getString(R.string.vault_lock_biometric_unavailable));
                return;
            }
            runBiometric(() -> {
                lock.unlock(VaultLock.Method.BIOMETRIC);
                applyLockState();
            });
        } else {
            showPasswordDialog(PasswordMode.UNLOCK, false);
        }
    }

    /**
     * Première ouverture : biométrie ou mot de passe si l'OS en propose une,
     * mot de passe obligatoire sinon.
     */
    private void startSetup() {
        if (!biometricAvailable()) {
            withDeviceAuthForSetup(() -> showPasswordDialog(PasswordMode.CREATE, true));
            return;
        }
        AlertDialog dialog = new MaterialAlertDialogBuilder(this)
                .setTitle(R.string.vault_lock_setup_title)
                .setMessage(R.string.vault_lock_setup_body)
                .setPositiveButton(R.string.vault_lock_use_biometric,
                        (d, w) -> runBiometric(() -> {
                            // L'invite biométrique est l'auth de l'appareil.
                            lock.authorizeSetup();
                            if (lock.state() == VaultLock.State.SETUP) lock.chooseBiometric();
                            applyLockState();
                        }))
                .setNegativeButton(R.string.vault_lock_use_password,
                        (d, w) -> withDeviceAuthForSetup(
                                () -> showPasswordDialog(PasswordMode.CREATE, true)))
                .setOnCancelListener(d -> finish())
                .create();
        track(dialog);
        dialog.show();
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

    /**
     * Garde de la mise en place (shared/spec/vault-lock.md, « Apps : une
     * seule session avec la clef ») : choisir une méthode ouvre la session
     * commune, donc la clef. Sans session valide, l'appareil doit d'abord
     * confirmer l'identité — sinon « Mot de passe oublié » puis un nouveau mot
     * de passe de carnet déverrouilleraient la clef sans biométrie.
     */
    private void withDeviceAuthForSetup(Runnable then) {
        if (!lock.setupNeedsDeviceAuth()) {
            // Session valide maintenant : elle peut expirer pendant la saisie.
            lock.authorizeSetup();
            then.run();
            return;
        }
        Runnable authorized = () -> {
            lock.authorizeSetup();
            then.run();
        };
        if (biometricAvailable()) {
            runBiometric(biometricAuthenticators(), R.string.vault_lock_setup_auth_title,
                    R.string.vault_lock_setup_auth_subtitle, authorized);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                && BiometricManager.from(this).canAuthenticate(
                        BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                        == BiometricManager.BIOMETRIC_SUCCESS) {
            runBiometric(BiometricManager.Authenticators.DEVICE_CREDENTIAL,
                    R.string.vault_lock_setup_auth_title,
                    R.string.vault_lock_setup_auth_subtitle, authorized);
            return;
        }
        // Avant Android 11, BiometricPrompt n'accepte pas le code seul.
        KeyguardManager keyguard = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        boolean secure = keyguard != null && (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? keyguard.isDeviceSecure() : keyguard.isKeyguardSecure());
        if (secure) {
            @SuppressWarnings("deprecation")
            Intent confirm = keyguard.createConfirmDeviceCredentialIntent(
                    getString(R.string.vault_lock_setup_auth_title),
                    getString(R.string.vault_lock_setup_auth_subtitle));
            if (confirm != null && !lock.isSystemAuthInProgress()) {
                pendingSetup = then;
                lock.beginSystemAuth();
                confirmDeviceCredential.launch(confirm);
                return;
            }
        }
        // Aucun écran de verrouillage sécurisé : l'appareil ne protège rien
        // au-delà de l'app elle-même, il n'y a rien à exiger de plus.
        authorized.run();
    }

    /** Suite de la mise en place, en attente du code de l'appareil (avant Android 11). */
    @Nullable
    private Runnable pendingSetup;

    private final ActivityResultLauncher<Intent> confirmDeviceCredential =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(),
                    result -> {
                        boolean ok = result.getResultCode() == RESULT_OK;
                        lock.endSystemAuth(ok);
                        Runnable then = pendingSetup;
                        pendingSetup = null;
                        if (ok && then != null) {
                            lock.authorizeSetup();
                            then.run();
                        }
                    });

    private boolean biometricAvailable() {
        return BiometricManager.from(this).canAuthenticate(biometricAuthenticators())
                == BiometricManager.BIOMETRIC_SUCCESS;
    }

    private void runBiometric(Runnable onSuccess) {
        runBiometric(biometricAuthenticators(), R.string.vault_locked_title,
                R.string.vault_locked_subtitle, onSuccess);
    }

    private void runBiometric(int authenticators, int titleRes, int subtitleRes,
                              Runnable onSuccess) {
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
                        // L'écran reste verrouillé, avec de quoi réessayer ou
                        // effacer le carnet. Si on l'a quitté pendant l'invite,
                        // la fenêtre de grâce tranche maintenant.
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
                .setTitle(getString(titleRes))
                .setSubtitle(getString(subtitleRes))
                .setAllowedAuthenticators(authenticators);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            info.setNegativeButtonText(getString(android.R.string.cancel));
        }
        prompt.authenticate(info.build());
    }

    private enum PasswordMode { UNLOCK, CREATE, CHANGE }

    /**
     * Saisie du mot de passe de carnet. Le bouton valide sans fermer : une
     * erreur s'affiche sous le champ, le dialogue ne se ferme qu'au succès.
     */
    private void showPasswordDialog(PasswordMode mode, boolean finishOnCancel) {
        View form = LayoutInflater.from(this).inflate(R.layout.dialog_vault_password, null);
        TextInputLayout currentLayout = form.findViewById(R.id.vaultPasswordCurrentLayout);
        TextInputLayout newLayout = form.findViewById(R.id.vaultPasswordNewLayout);
        TextInputLayout confirmLayout = form.findViewById(R.id.vaultPasswordConfirmLayout);
        EditText current = form.findViewById(R.id.vaultPasswordCurrent);
        EditText next = form.findViewById(R.id.vaultPasswordNew);
        EditText confirm = form.findViewById(R.id.vaultPasswordConfirm);

        boolean askCurrent = mode != PasswordMode.CREATE;
        boolean askNew = mode != PasswordMode.UNLOCK;
        currentLayout.setVisibility(askCurrent ? View.VISIBLE : View.GONE);
        newLayout.setVisibility(askNew ? View.VISIBLE : View.GONE);
        confirmLayout.setVisibility(askNew ? View.VISIBLE : View.GONE);
        if (mode == PasswordMode.UNLOCK) currentLayout.setHint(R.string.vault_lock_password);

        int title = mode == PasswordMode.UNLOCK ? R.string.vault_lock_enter_title
                : mode == PasswordMode.CREATE ? R.string.vault_lock_create_title
                : R.string.vault_lock_change_password;

        AlertDialog dialog = new MaterialAlertDialogBuilder(this)
                .setTitle(title)
                .setView(form)
                .setNegativeButton(android.R.string.cancel, (d, w) -> {
                    if (finishOnCancel) finish();
                })
                .setPositiveButton(android.R.string.ok, null)
                .setOnCancelListener(d -> {
                    if (finishOnCancel) finish();
                })
                .create();
        dialog.setOnShowListener(d -> {
            View ok = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
            ok.setOnClickListener(v -> {
                currentLayout.setError(null);
                newLayout.setError(null);
                confirmLayout.setError(null);

                if (askNew) {
                    VaultPassword.Check check = VaultPassword.checkNew(
                            next.getText().toString(), confirm.getText().toString());
                    if (check == VaultPassword.Check.TOO_SHORT) {
                        newLayout.setError(getString(R.string.vault_lock_password_rule));
                        return;
                    }
                    if (check == VaultPassword.Check.MISMATCH) {
                        confirmLayout.setError(getString(R.string.vault_lock_mismatch));
                        return;
                    }
                }
                ok.setEnabled(false);
                char[] currentChars = current.getText().toString().toCharArray();
                char[] newChars = next.getText().toString().toCharArray();
                submitPassword(mode, dialog, ok, currentLayout, currentChars, newChars);
            });
        });
        track(dialog);
        dialog.show();
    }

    /** PBKDF2 sur le fil de travail, application du résultat sur le fil principal. */
    private void submitPassword(PasswordMode mode, AlertDialog dialog, View ok,
                                TextInputLayout currentLayout,
                                char[] currentChars, char[] newChars) {
        int epoch = lockEpoch;
        toast(getString(R.string.vault_lock_checking));
        worker.execute(() -> {
            boolean verified = mode == PasswordMode.CREATE || lock.verifyPassword(currentChars);
            String record = verified && mode != PasswordMode.UNLOCK
                    ? VaultPassword.hash(newChars) : null;
            VaultPassword.wipe(currentChars);
            VaultPassword.wipe(newChars);

            main.post(() -> {
                // L'écran a été quitté pendant le calcul : il reste fermé.
                if (epoch != lockEpoch || isFinishing()) return;
                if (!verified) {
                    ok.setEnabled(true);
                    currentLayout.setError(getString(R.string.vault_lock_wrong));
                    return;
                }
                switch (mode) {
                    case UNLOCK:
                        lock.unlock(VaultLock.Method.PASSWORD);
                        break;
                    case CREATE:
                        boolean switching = lock.isUnlocked();
                        lock.choosePassword(record);
                        if (switching) toast(getString(R.string.vault_lock_method_changed));
                        break;
                    case CHANGE:
                        lock.changePassword(record);
                        toast(getString(R.string.vault_lock_password_changed));
                        break;
                }
                dialog.dismiss();
                applyLockState();
            });
        });
    }

    /** Changer le mot de passe, ou basculer biométrie ↔ mot de passe. */
    private void showLockSettings() {
        List<String> labels = new java.util.ArrayList<>();
        List<Runnable> actions = new java.util.ArrayList<>();
        if (lock.method() == VaultLock.Method.PASSWORD) {
            labels.add(getString(R.string.vault_lock_change_password));
            actions.add(() -> showPasswordDialog(PasswordMode.CHANGE, false));
            if (biometricAvailable()) {
                labels.add(getString(R.string.vault_lock_switch_biometric));
                actions.add(() -> runBiometric(() -> {
                    // Le verrou est différé pendant l'invite : l'écran est
                    // encore ouvert même si le code de l'appareil l'a quitté.
                    if (!lock.isUnlocked()) return;
                    lock.chooseBiometric();
                    toast(getString(R.string.vault_lock_method_changed));
                }));
            }
        } else {
            labels.add(getString(R.string.vault_lock_switch_password));
            actions.add(() -> showPasswordDialog(PasswordMode.CREATE, false));
        }

        AlertDialog dialog = new MaterialAlertDialogBuilder(this)
                .setTitle(R.string.vault_lock_settings)
                .setItems(labels.toArray(new CharSequence[0]),
                        (d, which) -> actions.get(which).run())
                .setNegativeButton(android.R.string.cancel, null)
                .create();
        track(dialog);
        dialog.show();
    }

    /** « Mot de passe oublié » : seule issue, efface le carnet local et le verrou. */
    private void confirmForget() {
        AlertDialog dialog = new MaterialAlertDialogBuilder(this)
                .setTitle(R.string.vault_lock_forgot_title)
                .setMessage(R.string.vault_lock_forgot_body)
                .setNegativeButton(android.R.string.cancel, null)
                .setPositiveButton(R.string.vault_lock_forgot_confirm, (d, w) -> {
                    Vault.wipe(this);
                    vault = new Vault();
                    lock.forget();
                    toast(getString(R.string.vault_lock_forgot_done));
                    main.post(this::applyLockState);
                })
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
            findViewById(R.id.vaultForgotAction).setVisibility(View.VISIBLE);
            return true;
        }
        if (id == R.id.action_vault_security) {
            showLockSettings();
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
                        ? getString(R.string.sync_limit_reached)
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
                main.post(() -> toast(getString(R.string.sync_failed, e.getMessage())));
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

    private void unlink() {
        if (preferences.getSyncCredentials() == null) {
            toast(getString(R.string.sync_nothing_to_unlink));
            return;
        }
        // Le carnet local reste : délier coupe la synchronisation, cela
        // n'efface rien.
        preferences.clearSyncCredentials();
        toast(getString(R.string.sync_unlinked));
        render(vault);
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
            // Jamais désactivé : un bouton éteint n'explique rien et ne
            // propose rien. C'est le clic qui dit ce que l'offre complète
            // apporte.
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
