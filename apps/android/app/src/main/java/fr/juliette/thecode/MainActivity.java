package fr.juliette.thecode;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;

import fr.juliette.thecode.autofill.TheCodeAutofillService;
import fr.juliette.thecode.vault.SaveProposal;
import fr.juliette.thecode.vault.Vault;
import fr.juliette.thecode.vault.VaultEntry;
import android.text.Editable;
import android.text.SpannableString;
import android.text.TextWatcher;
import android.text.method.HideReturnsTransformationMethod;
import android.text.method.LinkMovementMethod;
import android.text.method.PasswordTransformationMethod;
import android.text.util.Linkify;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.autofill.AutofillManager;
import android.widget.EditText;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.materialswitch.MaterialSwitch;
import com.google.android.material.slider.Slider;
import com.google.android.material.snackbar.Snackbar;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

/**
 * Écran principal : configuration de la clé, des options et génération du
 * mot de passe pour un site donné. Reproduit l'expérience de l'app Apple
 * en utilisant des composants Material Design.
 */
public class MainActivity extends AppCompatActivity {

    private TextInputLayout keyInputLayout;
    private TextInputEditText keyEditText;
    private android.view.View fingerprintRow;
    private android.widget.TextView fingerprintChip;
    private TextInputEditText siteEditText;
    private TextInputLayout loginInputLayout;
    private TextInputEditText loginEditText;
    private TextInputLayout passwordInputLayout;
    private TextInputEditText passwordEditText;
    private MaterialButton passwordRevealButton;
    private MaterialButton saveEntryButton;
    /**
     * Mot de passe généré, en clair. Le champ n'affiche qu'un masque tant que
     * l'utilisateur ne demande pas à le voir : copie et partage lisent ici.
     */
    private String currentPassword = "";
    private boolean passwordRevealed = false;
    private EditText lengthEditText;
    private TextView securityLabelTextView;
    private View resultCard;
    private Slider lengthSlider;
    private MaterialSwitch minSwitch, majSwitch, symSwitch, chiSwitch;
    private TextView autofillStatusText;
    private View autofillStatusDot;
    private MaterialButton autofillButton;
    private MaterialButton generateAuthButton;
    private View generateContent;

    private Preferences preferences;
    private SessionLock sessionLock;
    private final Code code = new Code();
    private boolean keyRevealed = false;

    /**
     * Session déverrouillée par auth biométrique. Réévaluée à chaque
     * {@link #onStart()} depuis {@link SessionLock} : elle survit donc à une
     * sortie (voire à une fermeture) de l'app tant que la fenêtre de grâce
     * n'est pas écoulée.
     */
    private boolean sessionUnlocked = false;

    /**
     * Bascule explicite vers l'ancien algorithme.
     *
     * La v2 est la règle ; la v1 ne sert qu'à retrouver un mot de passe posé
     * sur un site avant qu'elle n'existe.
     */
    /**
     * Mode de génération, remis à v2 à chaque lancement.
     *
     * Volontairement non persisté : la v1 est une exception, et une exception
     * qui survit à la fermeture se ferait oublier — on générerait en v1 sans
     * s'en souvenir.
     */
    private boolean useV1 = false;
    private MenuItem algoItem;
    /**
     * Basculer d'algorithme recrée l'écran pour changer de couleur : le mode
     * et l'annonce traversent la recréation par l'état sauvegardé.
     */
    private static final String STATE_USE_V1 = "useV1";
    private static final String STATE_ANNOUNCE_ALGO = "announceAlgo";
    private boolean announceAlgo = false;

    /**
     * Clef maîtresse déjà dérivée, et la clef dont elle vient.
     *
     * PBKDF2 à 600 000 itérations coûte quelques centaines de millisecondes :
     * la refaire à chaque frappe rendrait l'écran inutilisable. On la garde
     * tant que la clef saisie ne change pas.
     */
    private byte[] masterV2;
    private String masterV2For;

    /** Générations hors du fil qui dessine l'écran. */
    private final java.util.concurrent.ExecutorService worker =
            java.util.concurrent.Executors.newSingleThreadExecutor();
    private final android.os.Handler main =
            new android.os.Handler(android.os.Looper.getMainLooper());
    /** Numéro de la dernière demande : une réponse en retard est ignorée. */
    private int generation = 0;

    /** Pause a attendre avant de relancer un calcul coûteux. */
    private static final long KEY_DEBOUNCE_MS = 400;
    private Runnable pendingKeyWork;
    /** Garde contre les prompts multiples si l'utilisateur tape vite. */
    private boolean authInFlight = false;
    /** Évite la boucle slider → champ → slider lors de la synchronisation. */
    private boolean syncingLength = false;
    /** Date des réglages affichés : s'ils ont changé ailleurs, on les relit. */
    private String loadedSettingsAt;

    /** Carnet relu au retour sur l'écran : sert à préremplir l'identifiant. */
    private Vault vault = new Vault();
    /**
     * Vrai quand l'identifiant affiché vient du carnet et non d'une frappe :
     * il suit alors le site saisi, alors qu'une saisie de l'utilisateur reste.
     */
    private boolean loginPrefilled = false;
    /** Évite que le préremplissage passe pour une frappe de l'utilisateur. */
    private boolean settingLogin = false;
    /** Dernier site pour lequel l'enregistrement a été proposé : une fois suffit. */
    private String proposedFor;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        if (savedInstanceState != null) {
            useV1 = savedInstanceState.getBoolean(STATE_USE_V1, false);
            announceAlgo = savedInstanceState.getBoolean(STATE_ANNOUNCE_ALGO, false);
        }
        // Avant l'inflation : chaque vue lit colorPrimary à sa création.
        int overlay = AlgoTheme.overlayFor(useV1);
        if (overlay != 0) getTheme().applyStyle(overlay, true);
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        setSupportActionBar(findViewById(R.id.topAppBar));

        preferences = new Preferences(this);
        sessionLock = new SessionLock(preferences);

        bindViews();
        loadFromPreferences();
        wireListeners();
        // La clef restaurée ne passe pas par le watcher : sans cet appel,
        // l'empreinte ne s'affiche que si on la retape.
        updateFingerprint(preferences.getEncodingKey());

        // Seulement à l'ouverture de l'app : basculer v1/v2 ou changer de thème
        // recrée l'écran, et l'annonce revenait à chaque fois.
        if (savedInstanceState == null) showV2NoticeIfNeeded();
        applyLoginMode();
        if (announceAlgo) {
            announceAlgo = false;
            Snackbar.make(findViewById(android.R.id.content),
                    useV1 ? R.string.algo_now_v1 : R.string.algo_now_v2,
                    Snackbar.LENGTH_LONG).show();
        }

        regenerate();
    }

    /**
     * Relit ce qu'une synchronisation a pu changer : le carnet, et les
     * réglages par défaut s'ils sont arrivés d'un autre appareil — sans
     * toucher à ce qui n'a pas bougé.
     */
    private void reloadSynced() {
        vault = Vault.load(this);
        if (loadedSettingsAt != null
                && !loadedSettingsAt.equals(preferences.getSettingsUpdatedAt())) {
            loadDefaultSettings();
            regenerate();
        }
    }

    /** Silencieux : seul l'écran du carnet montre le statut de synchronisation. */
    private final AutoSync.Listener syncListener = new AutoSync.Listener() {
        @Override
        public void onSyncStatus(@NonNull String status) {
            // Rien : pas de message depuis une synchronisation automatique.
        }

        @Override
        public void onSyncFinished(@NonNull AutoSync.Outcome outcome) {
            if (!outcome.ok || isFinishing()) return;
            reloadSynced();
            updateSaveButton();
        }
    };

    @Override
    protected void onResume() {
        super.onResume();
        refreshAutofillStatus();
        reloadSynced();
        prefillLogin();
        // Ouverture ou retour au premier plan : la synchronisation automatique
        // s'en charge, espacée de 30 secondes.
        AutoSync autoSync = AutoSync.get(this);
        autoSync.addListener(syncListener);
        autoSync.onOpen();
        // Le pendant de onPause() est onResume(), pas onStart() : une activité
        // qui ne fait que recouvrir la nôtre (le code PIN du déverrouillage,
        // par exemple) provoque onPause() sans onStop(), donc sans onStart()
        // au retour — le mot de passe effacé dans onPause() serait resté
        // masqué jusqu'à une nouvelle frappe.
        //
        // La session n'est plus systématiquement reverrouillée : elle reste
        // valide tant que la fenêtre de grâce de SessionLock court. On
        // ré-horodate pour que la fenêtre reparte de ce retour au premier plan.
        sessionUnlocked = sessionLock.isValid();
        if (sessionUnlocked) {
            sessionLock.stamp();
        } else {
            sessionLock.invalidate();
        }
        // La clé reste masquée au retour, même avec une session valide : le
        // déverrouillage autorise à la révéler, il ne la révèle pas.
        applyKeyHidden();
        applySessionState();
    }

    @Override
    protected void onPause() {
        super.onPause();
        AutoSync.get(this).removeListener(syncListener);
        // Fait courir la fenêtre de grâce à partir de la mise en arrière-plan.
        if (sessionUnlocked) sessionLock.stamp();
        // Le snapshot de l'écran « Applications récentes » est capturé ici : on
        // remasque la clé et on efface le mot de passe pour qu'il n'y figure
        // pas. Les deux sont restitués à la reprise (cf. onStart).
        applyKeyHidden();
        showPassword("");
        resultCard.setVisibility(View.GONE);
    }

    private void bindViews() {
        keyInputLayout = findViewById(R.id.keyInputLayout);
        keyEditText = findViewById(R.id.keyEditText);
        fingerprintRow = findViewById(R.id.fingerprintRow);
        fingerprintChip = findViewById(R.id.fingerprintChip);
        siteEditText = findViewById(R.id.siteEditText);
        loginInputLayout = findViewById(R.id.loginInputLayout);
        loginEditText = findViewById(R.id.loginEditText);
        passwordInputLayout = findViewById(R.id.passwordInputLayout);
        passwordEditText = findViewById(R.id.passwordEditText);
        passwordRevealButton = findViewById(R.id.passwordRevealButton);
        saveEntryButton = findViewById(R.id.saveEntryButton);
        lengthEditText = findViewById(R.id.lengthEditText);
        securityLabelTextView = findViewById(R.id.securityLabelTextView);
        resultCard = findViewById(R.id.resultCard);
        lengthSlider = findViewById(R.id.lengthSlider);
        minSwitch = findViewById(R.id.minSwitch);
        majSwitch = findViewById(R.id.majSwitch);
        symSwitch = findViewById(R.id.symSwitch);
        chiSwitch = findViewById(R.id.chiSwitch);
        autofillStatusText = findViewById(R.id.autofillStatusText);
        autofillStatusDot = findViewById(R.id.autofillStatusDot);
        autofillButton = findViewById(R.id.autofillButton);
        generateAuthButton = findViewById(R.id.generateAuthButton);
        generateContent = findViewById(R.id.generateContent);
    }

    private void loadFromPreferences() {
        keyEditText.setText(preferences.getEncodingKey());
        loadDefaultSettings();
    }

    /** Longueur et jeux de caractères, tels que retenus (ou reçus du compte). */
    private void loadDefaultSettings() {
        loadedSettingsAt = preferences.getSettingsUpdatedAt();
        int length = clamp(preferences.getLength(), Code.MIN_LENGTH, Code.MAX_LENGTH);
        lengthSlider.setValueFrom(Code.MIN_LENGTH);
        lengthSlider.setValueTo(Code.MAX_LENGTH);
        lengthSlider.setStepSize(1f);
        lengthSlider.setValue(length);
        setLengthText(length);

        minSwitch.setChecked(preferences.getMinState());
        majSwitch.setChecked(preferences.getMajState());
        symSwitch.setChecked(preferences.getSymState());
        chiSwitch.setChecked(preferences.getChiState());
    }

    private void wireListeners() {
        keyEditText.addTextChangedListener(new SimpleTextWatcher() {
            @Override
            public void afterTextChanged(Editable s) {
                preferences.setEncodingKey(s.toString());
                // Empreinte et v2 passent chacune par PBKDF2 a 600 000
                // iterations : les lancer a chaque frappe fige la saisie. On
                // attend une pause avant de calculer.
                scheduleKeyWork(s.toString());
            }
        });

        siteEditText.addTextChangedListener(new SimpleTextWatcher() {
            @Override
            public void afterTextChanged(Editable s) {
                prefillLogin();
                regenerate();
            }
        });

        loginEditText.addTextChangedListener(new SimpleTextWatcher() {
            @Override
            public void afterTextChanged(Editable s) {
                if (!settingLogin) loginPrefilled = false;
                regenerate();
            }
        });

        lengthSlider.addOnChangeListener((slider, value, fromUser) -> {
            if (syncingLength) return;
            int v = (int) value;
            setLengthText(v);
            preferences.setLength(v);
            regenerate();
        });

        lengthEditText.addTextChangedListener(new SimpleTextWatcher() {
            @Override
            public void afterTextChanged(Editable s) {
                if (syncingLength) return;
                Integer v = parseLength(s.toString());
                // Saisie complète et dans les bornes → appliquée tout de suite.
                // Une saisie partielle (« 3 » en tapant « 30 ») est laissée
                // telle quelle et sera bornée à la validation.
                if (v != null) applyLength(v, false);
            }
        });

        // Le champ ne perd pas forcément le focus : on valide aussi sur « OK ».
        lengthEditText.setOnEditorActionListener((v, actionId, event) -> {
            commitLengthText();
            return false;
        });
        lengthEditText.setOnFocusChangeListener((v, hasFocus) -> {
            if (!hasFocus) commitLengthText();
        });

        minSwitch.setOnCheckedChangeListener((b, checked) -> { preferences.setMinState(checked); regenerate(); });
        majSwitch.setOnCheckedChangeListener((b, checked) -> { preferences.setMajState(checked); regenerate(); });
        symSwitch.setOnCheckedChangeListener((b, checked) -> { preferences.setSymState(checked); regenerate(); });
        chiSwitch.setOnCheckedChangeListener((b, checked) -> { preferences.setChiState(checked); regenerate(); });

        passwordInputLayout.setEndIconOnClickListener(v -> copyPassword());
        passwordRevealButton.setOnClickListener(v -> {
            passwordRevealed = !passwordRevealed;
            applyPasswordDisplay();
        });
        saveEntryButton.setOnClickListener(v -> saveToVault());

        keyInputLayout.setEndIconOnClickListener(v -> onKeyToggleClicked());

        autofillButton.setOnClickListener(v -> openAutofillSettings());

        generateAuthButton.setOnClickListener(v ->
                promptUnlock(R.string.generate_auth_title, R.string.generate_auth_subtitle,
                        () -> {
                            applySessionState();
                            siteEditText.requestFocus();
                        }));
    }

    /**
     * Reflète l'état du verrou dans l'UI : verrouillé, on n'affiche que le
     * bouton d'authentification ; déverrouillé, le champ « nom du site » (et
     * le résultat) devient disponible. Le mot de passe affiché est vidé au
     * reverrouillage pour ne rien laisser s'afficher après expiration.
     */
    private void applySessionState() {
        generateAuthButton.setVisibility(sessionUnlocked ? View.GONE : View.VISIBLE);
        generateContent.setVisibility(sessionUnlocked ? View.VISIBLE : View.GONE);
        if (!sessionUnlocked) {
            // Le nom du site n'est pas un secret : on le conserve (le flux de
            // déverrouillage par code PIN passe par onStart avant la réussite
            // de l'auth, l'effacer ferait perdre la saisie).
            showPassword("");
            resultCard.setVisibility(View.GONE);
        } else {
            regenerate();
        }
    }

    /** Longueur saisie, ou null si elle n'est pas (encore) dans les bornes. */
    static Integer parseLength(String raw) {
        try {
            int v = Integer.parseInt(raw.trim());
            return (v >= Code.MIN_LENGTH && v <= Code.MAX_LENGTH) ? v : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Écrit la valeur dans le champ sans déclencher le watcher. */
    private void setLengthText(int length) {
        syncingLength = true;
        lengthEditText.setText(String.valueOf(length));
        lengthEditText.setSelection(lengthEditText.getText().length());
        syncingLength = false;
    }

    /**
     * Applique une longueur : persistée, poussée sur le slider et régénérée.
     * {@code rewriteText} ne remet le texte à jour que si la valeur a été
     * corrigée, pour ne pas réécrire le champ sous les doigts de l'utilisateur.
     */
    private void applyLength(int length, boolean rewriteText) {
        int clamped = clamp(length, Code.MIN_LENGTH, Code.MAX_LENGTH);
        preferences.setLength(clamped);
        syncingLength = true;
        lengthSlider.setValue(clamped);
        syncingLength = false;
        if (rewriteText) setLengthText(clamped);
        regenerate();
    }

    /**
     * Valide la saisie en cours : vide, partielle ou hors bornes, elle est
     * ramenée dans les limites plutôt que silencieusement ignorée.
     */
    private void commitLengthText() {
        Integer parsed = parseLength(textOf(lengthEditText));
        if (parsed != null) {
            applyLength(parsed, true);
            return;
        }
        int fallback;
        try {
            fallback = clamp(Integer.parseInt(textOf(lengthEditText).trim()),
                    Code.MIN_LENGTH, Code.MAX_LENGTH);
        } catch (NumberFormatException e) {
            fallback = (int) lengthSlider.getValue();
        }
        applyLength(fallback, true);
    }

    private void applyKeyHidden() {
        keyRevealed = false;
        int selection = textOf(keyEditText).length();
        keyEditText.setTransformationMethod(PasswordTransformationMethod.getInstance());
        keyEditText.setSelection(Math.min(selection, textOf(keyEditText).length()));
        keyInputLayout.setEndIconDrawable(R.drawable.ic_visibility);
        keyInputLayout.setEndIconContentDescription(getString(R.string.show_key));
    }

    private void applyKeyRevealed() {
        keyRevealed = true;
        int selection = textOf(keyEditText).length();
        keyEditText.setTransformationMethod(HideReturnsTransformationMethod.getInstance());
        keyEditText.setSelection(Math.min(selection, textOf(keyEditText).length()));
        keyInputLayout.setEndIconDrawable(R.drawable.ic_visibility_off);
        keyInputLayout.setEndIconContentDescription(getString(R.string.hide_key));
    }

    private void onKeyToggleClicked() {
        if (keyRevealed) {
            applyKeyHidden();
            return;
        }
        // Si la clé est vide, l'utilisateur s'apprête à la saisir : pas besoin
        // d'authentification pour passer en mode visible.
        if (textOf(keyEditText).isEmpty()) {
            applyKeyRevealed();
            return;
        }
        if (sessionUnlocked) {
            applyKeyRevealed();
            return;
        }
        promptUnlock(R.string.key_reveal_auth_title, R.string.key_reveal_auth_subtitle,
                this::applyKeyRevealed);
    }

    /**
     * Déclenche {@link BiometricPrompt}, et exécute {@code onSuccess} si l'auth
     * réussit, en marquant la session comme déverrouillée. Sans matériel
     * d'auth disponible (rare), on considère le terminal déjà déverrouillé.
     */
    private void promptUnlock(int titleRes, int subtitleRes, Runnable onSuccess) {
        if (authInFlight) return;

        int authenticators = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
                ? (BiometricManager.Authenticators.BIOMETRIC_WEAK
                    | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                : BiometricManager.Authenticators.BIOMETRIC_WEAK;

        BiometricManager bm = BiometricManager.from(this);
        if (bm.canAuthenticate(authenticators) != BiometricManager.BIOMETRIC_SUCCESS) {
            sessionUnlocked = true;
            sessionLock.stamp();
            onSuccess.run();
            return;
        }

        authInFlight = true;
        BiometricPrompt prompt = new BiometricPrompt(this,
                ContextCompat.getMainExecutor(this),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        authInFlight = false;
                        sessionUnlocked = true;
                        sessionLock.stamp();
                        onSuccess.run();
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        authInFlight = false;
                    }
                });

        BiometricPrompt.PromptInfo.Builder infoBuilder = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(getString(titleRes))
                .setSubtitle(getString(subtitleRes))
                .setAllowedAuthenticators(authenticators);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            infoBuilder.setNegativeButtonText(getString(android.R.string.cancel));
        }
        prompt.authenticate(infoBuilder.build());
    }

    private void refreshAutofillStatus() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            autofillStatusText.setText(R.string.autofill_status_unsupported);
            autofillButton.setEnabled(false);
            tintStatusDot(R.color.safety_weak);
            return;
        }
        AutofillManager am = getSystemService(AutofillManager.class);
        boolean available = am != null && am.isAutofillSupported();
        boolean enabled = available && isOurAutofillServiceEnabled(am);

        if (!available) {
            autofillStatusText.setText(R.string.autofill_status_unsupported);
            autofillButton.setEnabled(false);
            tintStatusDot(R.color.safety_weak);
        } else if (enabled) {
            autofillStatusText.setText(R.string.autofill_status_active);
            autofillButton.setText(R.string.autofill_open_settings);
            autofillButton.setEnabled(true);
            tintStatusDot(R.color.safety_very_strong);
        } else {
            autofillStatusText.setText(R.string.autofill_status_inactive);
            autofillButton.setText(R.string.autofill_enable);
            autofillButton.setEnabled(true);
            tintStatusDot(R.color.safety_none);
        }
    }

    /**
     * AutofillManager.hasEnabledAutofillServices() peut renvoyer un état périmé
     * au lancement (false alors que le service est bien actif), jusqu'à ce que
     * l'utilisateur retourne dans les réglages. On recroise donc avec
     * Settings.Secure (clé « autofill_service ») qui reflète le réglage réel.
     */
    private boolean isOurAutofillServiceEnabled(AutofillManager am) {
        // Le framework Autofill n'existe qu'a partir d'Android 8 (API 26), alors
        // que minSdk vaut 21 : appeler hasEnabledAutofillServices sans garde
        // plante sur Android 5.0 a 7.1. openAutofillSettings() avait deja ce
        // garde, pas celui-ci.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;

        if (am != null && am.hasEnabledAutofillServices()) return true;

        String setting = Settings.Secure.getString(
                getContentResolver(), "autofill_service");
        if (setting == null || setting.isEmpty()) return false;

        ComponentName configured = ComponentName.unflattenFromString(setting);
        ComponentName ours = new ComponentName(this, TheCodeAutofillService.class);
        return ours.equals(configured);
    }

    /**
     * Repousse le calcul jusqu'a une pause dans la frappe.
     *
     * Chaque frappe annule la demande precedente : seule la derniere, celle
     * qui suit la pause, va au bout.
     */
    private void scheduleKeyWork(String masterKey) {
        if (pendingKeyWork != null) main.removeCallbacks(pendingKeyWork);
        pendingKeyWork = () -> {
            updateFingerprint(masterKey);
            regenerate();
        };
        main.postDelayed(pendingKeyWork, KEY_DEBOUNCE_MS);
    }

    /**
     * Affiche l'empreinte de la clef.
     *
     * Le calcul passe par PBKDF2 à 600 000 itérations : volontairement coûteux,
     * donc hors du fil principal pour ne pas figer la saisie.
     */
    private void updateFingerprint(String masterKey) {
        if (masterKey == null || masterKey.isEmpty()) {
            fingerprintRow.setVisibility(android.view.View.GONE);
            return;
        }

        new Thread(() -> {
            Fingerprint.Result result = Fingerprint.of(masterKey);
            runOnUiThread(() -> {
                // La clef a pu changer pendant le calcul : on n'affiche que si
                // l'empreinte correspond encore à ce qui est saisi.
                if (!masterKey.equals(textOf(keyEditText))) return;

                if (result == null) {
                    fingerprintRow.setVisibility(android.view.View.GONE);
                    return;
                }
                fingerprintChip.setText(result.text);
                fingerprintChip.setBackgroundColor(result.color);
                fingerprintRow.setVisibility(android.view.View.VISIBLE);
            });
        }).start();
    }

    private void tintStatusDot(int colorRes) {
        autofillStatusDot.getBackground().setTint(ContextCompat.getColor(this, colorRes));
    }

    private void openAutofillSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        if (preferences.getEncodingKey().isEmpty()) {
            Snackbar.make(autofillButton, R.string.autofill_no_key_warning,
                    Snackbar.LENGTH_LONG).show();
            keyEditText.requestFocus();
            return;
        }

        AutofillManager am = getSystemService(AutofillManager.class);
        boolean enabled = am != null && am.hasEnabledAutofillServices();
        try {
            if (enabled) {
                startActivity(new Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE));
            } else {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            }
        } catch (Exception e) {
            startActivity(new Intent(Settings.ACTION_SETTINGS));
        }
    }

    /**
     * Affiche l'annonce du passage a la v2, une fois.
     *
     * Elle ne concerne que la version qui l'apporte : une fois lue, on ne la
     * repose plus.
     */
    /**
     * Annonce du passage a la v2, en boite de dialogue a l'ouverture.
     *
     * Fermer la fait revenir la prochaine fois : une annonce qu'on n'a pas eu
     * le temps de lire ne doit pas disparaitre pour toujours.
     */
    private void showV2NoticeIfNeeded() {
        if (preferences.getV2NoticeSeen()) return;

        View content = getLayoutInflater().inflate(R.layout.dialog_v2_notice, null);
        com.google.android.material.checkbox.MaterialCheckBox neverAgain =
                content.findViewById(R.id.v2NoticeNeverAgain);

        new MaterialAlertDialogBuilder(this)
                .setTitle(R.string.v2_notice_title)
                .setView(content)
                // Fermer suffit a la faire partir ; seule la case la retire
                // pour de bon.
                .setPositiveButton(R.string.v2_notice_close, (dialog, which) -> {
                    if (neverAgain.isChecked()) preferences.setV2NoticeSeen();
                })
                .show();
    }

    private void regenerate() {
        String key = textOf(keyEditText);
        String site = textOf(siteEditText);

        // Chaque nouvelle génération repart masquée : un mot de passe révélé
        // pour un site ne doit pas rester à l'écran pour le suivant.
        passwordRevealed = false;

        boolean anyCharset = minSwitch.isChecked() || majSwitch.isChecked()
                || symSwitch.isChecked() || chiSwitch.isChecked();

        if (key.isEmpty() || site.isEmpty() || !anyCharset) {
            showPassword("");
            resultCard.setVisibility(View.GONE);
            return;
        }

        // La clé est un secret : sa transformation en mot de passe exige une
        // session authentifiée. Plus de prompt implicite déclenché par la
        // frappe : tant que la session est verrouillée le champ « nom du
        // site » n'est même pas affiché (cf. applySessionState).
        if (!sessionUnlocked) {
            showPassword("");
            resultCard.setVisibility(View.GONE);
            return;
        }
        applyPasswordDisplay();

        code.setMinState(minSwitch.isChecked());
        code.setMajState(majSwitch.isChecked());
        code.setSymState(symSwitch.isChecked());
        code.setChiState(chiSwitch.isChecked());
        code.setLength((int) lengthSlider.getValue());
        code.updateSafetyAndColor();

        // La version en cours doit se lire sans ouvrir de menu : c'est elle
        // qui décide quel mot de passe sort.
        securityLabelTextView.setText(getString(R.string.security_with_algo,
                getString(safetyLabelRes(code.getSafetyLevel())),
                useV1 ? 1 : 2));
        securityLabelTextView.setTextColor(code.getColor());
        resultCard.setVisibility(View.VISIBLE);

        if (useV1) {
            // La v1 est un simple SHA-256 : instantané, rien à déporter.
            showPassword(code.getCode(key, site));
            return;
        }

        // Vide = le comportement d'avant le champ, au caractère près.
        final String login = textOf(loginEditText).trim();
        final int ticket = ++generation;
        worker.execute(() -> {
            try {
                if (masterV2 == null || !key.equals(masterV2For)) {
                    masterV2 = CodeV2.deriveMasterKey(key);
                    masterV2For = key;
                }
                String result = CodeV2.getCode(code, key, site, login, 1, masterV2);
                // Une réponse arrivée après une frappe plus récente
                // afficherait le mot de passe d'un autre site.
                main.post(() -> {
                    if (ticket == generation) showPassword(result);
                });
            } catch (java.security.GeneralSecurityException e) {
                main.post(() -> {
                    if (ticket == generation) showPassword("");
                });
            }
        });
    }

    /** Retient le mot de passe généré et l'affiche selon le masquage en cours. */
    private void showPassword(String password) {
        currentPassword = password == null ? "" : password;
        applyPasswordDisplay();
        updateSaveButton();
    }

    private void applyPasswordDisplay() {
        passwordEditText.setText(GeneratedPassword.display(currentPassword, passwordRevealed));
        passwordRevealButton.setIconResource(passwordRevealed
                ? R.drawable.ic_visibility_off : R.drawable.ic_visibility);
        passwordRevealButton.setContentDescription(getString(passwordRevealed
                ? R.string.hide_password : R.string.show_password));
    }

    /**
     * Le bouton d'enregistrement n'apparaît qu'avec un mot de passe, et dit
     * s'il crée l'entrée ou met à jour celle du compte. Pas en v1 : le carnet
     * n'admet que la v2, l'entrée donnerait un autre mot de passe que celui
     * affiché.
     */
    private void updateSaveButton() {
        boolean shown = !useV1 && !currentPassword.isEmpty();
        saveEntryButton.setVisibility(shown ? View.VISIBLE : View.GONE);
        if (!shown) return;
        boolean update = GeneratedPassword.hasEntry(vault,
                textOf(siteEditText), textOf(loginEditText));
        saveEntryButton.setText(update ? R.string.vault_update_entry : R.string.vault_save_entry);
    }

    @Override
    protected void onDestroy() {
        if (pendingKeyWork != null) main.removeCallbacks(pendingKeyWork);
        worker.shutdownNow();
        super.onDestroy();
    }

    private static int safetyLabelRes(Code.SafetyLevel level) {
        switch (level) {
            case NONE:        return R.string.safety_none;
            case VERY_WEAK:   return R.string.safety_very_weak;
            case WEAK:        return R.string.safety_weak;
            case MEDIUM:      return R.string.safety_medium;
            case STRONG:      return R.string.safety_strong;
            case VERY_STRONG:
            default:          return R.string.safety_very_strong;
        }
    }

    private void copyPassword() {
        String password = currentPassword;
        if (password.isEmpty()) {
            Snackbar.make(resultCard, R.string.no_password_to_copy, Snackbar.LENGTH_SHORT).show();
            return;
        }
        ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        cm.setPrimaryClip(ClipData.newPlainText(getString(R.string.clipboard_label), password));
        if (!proposeSaveIfNeeded(R.string.vault_propose_save_copied)) {
            Snackbar.make(resultCard, R.string.password_copied, Snackbar.LENGTH_SHORT).show();
        }
    }

    /**
     * Propose d'enregistrer au carnet le site dont on vient d'utiliser le mot
     * de passe, quand un compte de synchronisation est lié et que le carnet ne
     * le connaît pas (règle partagée avec le remplissage automatique).
     *
     * Pas en v1 : le carnet n'admet que la v2, l'entrée créée donnerait un
     * autre mot de passe que celui affiché.
     *
     * @return vrai si la proposition a été affichée.
     */
    private boolean proposeSaveIfNeeded(int messageRes) {
        if (useV1) return false;
        String site = textOf(siteEditText).trim();
        if (site.equals(proposedFor)) return false;
        boolean linked = preferences.getSyncCredentials() != null;
        if (!SaveProposal.shouldPropose(linked, vault, site)) return false;

        proposedFor = site;
        Snackbar.make(resultCard, messageRes, Snackbar.LENGTH_LONG)
                .setAction(R.string.vault_propose_save_action, v -> saveToVault())
                .show();
        return true;
    }

    private void share() {
        String password = currentPassword;
        String site = textOf(siteEditText);
        if (password.isEmpty()) {
            Snackbar.make(findViewById(android.R.id.content),
                    R.string.no_password_to_share, Snackbar.LENGTH_SHORT).show();
            return;
        }
        Intent share = new Intent(Intent.ACTION_SEND);
        share.setType("text/plain");
        share.putExtra(Intent.EXTRA_TEXT,
                getString(R.string.share_text, site, password));
        startActivity(Intent.createChooser(share, getString(R.string.share_title)));
        proposeSaveIfNeeded(R.string.vault_propose_save);
    }

    private void showHelp() {
        SpannableString message = new SpannableString(getString(R.string.info_app));
        Linkify.addLinks(message, Linkify.ALL);
        AlertDialog dialog = new MaterialAlertDialogBuilder(this)
                .setTitle(R.string.help_title)
                .setMessage(message)
                .setPositiveButton(android.R.string.ok, null)
                .create();
        dialog.show();
        TextView messageView = dialog.findViewById(android.R.id.message);
        if (messageView != null) {
            messageView.setMovementMethod(LinkMovementMethod.getInstance());
        }
    }

    private void toggleTheme() {
        // On bascule par rapport au mode RÉELLEMENT affiché (pas par rapport à
        // la préférence stockée), sinon en mode SYSTEM le premier tap ne change
        // rien visuellement et il faut taper une seconde fois.
        int nightMask = getResources().getConfiguration().uiMode
                & Configuration.UI_MODE_NIGHT_MASK;
        boolean currentlyDark = nightMask == Configuration.UI_MODE_NIGHT_YES;
        String next = currentlyDark ? "LIGHT" : "DARK";
        preferences.setDarkMode(next);
        AppCompatDelegate.setDefaultNightMode(currentlyDark
                ? AppCompatDelegate.MODE_NIGHT_NO
                : AppCompatDelegate.MODE_NIGHT_YES);
        recreate();
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.menu_main, menu);

        // Un bouton qui affiche le mode en cours, comme celui du theme : le
        // lire ne doit pas demander d'ouvrir un menu.
        algoItem = menu.findItem(R.id.action_algo);
        com.google.android.material.button.MaterialButton button =
                (com.google.android.material.button.MaterialButton) algoItem.getActionView();
        if (button != null) {
            button.setOnClickListener(v -> toggleAlgo());
        }
        applyAlgoLabel();
        return true;
    }

    /** Bascule entre les deux algorithmes et le fait savoir. */
    private void toggleAlgo() {
        useV1 = !useV1;
        // Recréer plutôt que reteindre vue par vue : boutons, interrupteurs,
        // champs et barre reprennent tous la couleur du thème, en clair comme
        // en sombre. onCreate régénère et annonce le nouveau mode.
        announceAlgo = true;
        recreate();
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putBoolean(STATE_USE_V1, useV1);
        outState.putBoolean(STATE_ANNOUNCE_ALGO, announceAlgo);
    }

    /**
     * La v1 ignore l'identifiant : le champ reste lisible mais éteint, avec la
     * raison, plutôt que de laisser croire qu'il change le mot de passe.
     */
    private void applyLoginMode() {
        loginInputLayout.setEnabled(!useV1);
        loginInputLayout.setHelperText(useV1 ? getString(R.string.login_helper_v1) : null);
    }

    /**
     * Préremplit l'identifiant depuis l'entrée du carnet qui couvre le site.
     *
     * Un identifiant tapé par l'utilisateur n'est jamais écrasé ; un
     * identifiant prérempli suit le site, et disparaît s'il n'est plus couvert.
     */
    private void prefillLogin() {
        String current = textOf(loginEditText);
        if (!current.isEmpty() && !loginPrefilled) return;

        String site = textOf(siteEditText).trim();
        VaultEntry match = site.isEmpty() ? null : vault.findByDomain(site);
        String next = match == null ? "" : Vault.loginOf(match.login);
        if (!next.equals(current)) {
            settingLogin = true;
            loginEditText.setText(next);
            settingLogin = false;
        }
        loginPrefilled = !next.isEmpty();
    }

    private void applyAlgoLabel() {
        if (algoItem == null) return;
        int label = useV1 ? R.string.algo_mode_v1 : R.string.algo_mode_v2;
        algoItem.setTitle(label);

        com.google.android.material.button.MaterialButton button =
                (com.google.android.material.button.MaterialButton) algoItem.getActionView();
        if (button != null) button.setText(label);
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        int id = item.getItemId();
        if (id == R.id.action_algo) {
            toggleAlgo();
            return true;
        } else if (id == R.id.action_vault) {
            startActivity(new android.content.Intent(this, VaultActivity.class));
            return true;
        } else if (id == R.id.action_dark_mode) {
            toggleTheme();
            return true;
        } else if (id == R.id.action_help) {
            showHelp();
            return true;
        } else if (id == R.id.action_share) {
            share();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    /**
     * Enregistre les réglages du site affiché.
     *
     * Le site est pris tel qu'il a été saisi : c'est lui qui a produit le mot
     * de passe à l'écran, le canonicaliser ici enregistrerait des réglages sous
     * une clef qui en produit un autre.
     */
    private void saveToVault() {
        String site = textOf(siteEditText).trim();
        // Le bouton n'apparaît qu'avec un mot de passe, donc avec un site.
        if (site.isEmpty() || currentPassword.isEmpty()) return;

        String login = textOf(loginEditText).trim();
        // Relu juste avant d'écrire : la copie de l'écran peut dater.
        vault = Vault.load(this);
        // Domaine et identifiant désignent le compte : un autre identifiant
        // sur le même site est une autre entrée.
        VaultEntry entry = vault.upsertAccount(site, login, (int) lengthSlider.getValue(),
                minSwitch.isChecked(), majSwitch.isChecked(),
                symSwitch.isChecked(), chiSwitch.isChecked());
        // Une entrée du carnet dérive toujours en v2, même enregistrée depuis
        // l'écran réglé en v1 : elle ne porte aucune version.
        vault.save(this);
        updateSaveButton();

        // Une entrée existante garde son siteKey : le réécrire changerait un
        // mot de passe déjà en service. On le dit plutôt que de laisser croire
        // que le mot de passe affiché est celui de l'entrée.
        String shown = login.isEmpty() ? site : site + " · " + login;
        String message = entry.siteKey.equals(site)
                ? getString(R.string.vault_saved, shown)
                : getString(R.string.vault_saved_other_key, shown, entry.siteKey);
        Snackbar.make(findViewById(android.R.id.content), message, Snackbar.LENGTH_LONG).show();
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static String textOf(EditText editText) {
        Editable e = editText.getText();
        return e == null ? "" : e.toString();
    }

    private abstract static class SimpleTextWatcher implements TextWatcher {
        @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
        @Override public void onTextChanged(CharSequence s, int start, int before, int count) {}
    }
}
