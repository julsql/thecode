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
    private TextInputLayout passwordInputLayout;
    private TextInputEditText passwordEditText;
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
    /** Garde contre les prompts multiples si l'utilisateur tape vite. */
    private boolean authInFlight = false;
    /** Évite la boucle slider → champ → slider lors de la synchronisation. */
    private boolean syncingLength = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        setSupportActionBar(findViewById(R.id.topAppBar));

        preferences = new Preferences(this);
        sessionLock = new SessionLock(preferences);

        bindViews();
        loadFromPreferences();
        wireListeners();
        regenerate();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshAutofillStatus();
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
        // Fait courir la fenêtre de grâce à partir de la mise en arrière-plan.
        if (sessionUnlocked) sessionLock.stamp();
        // Le snapshot de l'écran « Applications récentes » est capturé ici : on
        // remasque la clé et on efface le mot de passe pour qu'il n'y figure
        // pas. Les deux sont restitués à la reprise (cf. onStart).
        applyKeyHidden();
        passwordEditText.setText("");
        resultCard.setVisibility(View.GONE);
    }

    private void bindViews() {
        keyInputLayout = findViewById(R.id.keyInputLayout);
        keyEditText = findViewById(R.id.keyEditText);
        fingerprintRow = findViewById(R.id.fingerprintRow);
        fingerprintChip = findViewById(R.id.fingerprintChip);
        siteEditText = findViewById(R.id.siteEditText);
        passwordInputLayout = findViewById(R.id.passwordInputLayout);
        passwordEditText = findViewById(R.id.passwordEditText);
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
                updateFingerprint(s.toString());
                regenerate();
            }
        });

        siteEditText.addTextChangedListener(new SimpleTextWatcher() {
            @Override
            public void afterTextChanged(Editable s) {
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
            passwordEditText.setText("");
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

    private void regenerate() {
        String key = textOf(keyEditText);
        String site = textOf(siteEditText);

        boolean anyCharset = minSwitch.isChecked() || majSwitch.isChecked()
                || symSwitch.isChecked() || chiSwitch.isChecked();

        if (key.isEmpty() || site.isEmpty() || !anyCharset) {
            resultCard.setVisibility(View.GONE);
            return;
        }

        // La clé est un secret : sa transformation en mot de passe exige une
        // session authentifiée. Plus de prompt implicite déclenché par la
        // frappe : tant que la session est verrouillée le champ « nom du
        // site » n'est même pas affiché (cf. applySessionState).
        if (!sessionUnlocked) {
            resultCard.setVisibility(View.GONE);
            return;
        }

        code.setMinState(minSwitch.isChecked());
        code.setMajState(majSwitch.isChecked());
        code.setSymState(symSwitch.isChecked());
        code.setChiState(chiSwitch.isChecked());
        code.setLength((int) lengthSlider.getValue());
        code.updateSafetyAndColor();

        String result = code.getCode(key, site);
        passwordEditText.setText(result);
        securityLabelTextView.setText(getString(R.string.security_with_value,
                getString(safetyLabelRes(code.getSafetyLevel()))));
        securityLabelTextView.setTextColor(code.getColor());
        resultCard.setVisibility(View.VISIBLE);
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
        String password = textOf(passwordEditText);
        if (password.isEmpty()) {
            Snackbar.make(resultCard, R.string.no_password_to_copy, Snackbar.LENGTH_SHORT).show();
            return;
        }
        ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        cm.setPrimaryClip(ClipData.newPlainText(getString(R.string.clipboard_label), password));
        Snackbar.make(resultCard, R.string.password_copied, Snackbar.LENGTH_SHORT).show();
    }

    private void share() {
        String password = textOf(passwordEditText);
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
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        int id = item.getItemId();
        if (id == R.id.action_vault) {
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
