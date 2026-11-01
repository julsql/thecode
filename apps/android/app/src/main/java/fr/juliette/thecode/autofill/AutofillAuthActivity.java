package fr.juliette.thecode.autofill;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Parcelable;
import android.os.SystemClock;
import android.app.AlertDialog;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillManager;
import android.view.autofill.AutofillValue;
import android.widget.RemoteViews;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import android.service.autofill.Dataset;

import fr.juliette.thecode.Generator;
import fr.juliette.thecode.vault.LoginSuggestions;
import fr.juliette.thecode.vault.SiteResolution;
import fr.juliette.thecode.vault.Vault;
import fr.juliette.thecode.Preferences;
import fr.juliette.thecode.R;

/**
 * Activité « invisible » lancée par le système quand l'utilisateur sélectionne
 * notre proposition d'autofill. Elle déclenche une authentification biométrique
 * puis renvoie au système le {@link Dataset} qui remplit le champ mot de passe.
 */
@RequiresApi(Build.VERSION_CODES.O)
public class AutofillAuthActivity extends FragmentActivity {

    public static final String EXTRA_DOMAIN = "fr.juliette.thecode.autofill.DOMAIN";
    /** Entrée du carnet choisie, vide quand le carnet ne connaît pas le site. */
    public static final String EXTRA_ENTRY_ID = "fr.juliette.thecode.autofill.ENTRY_ID";
    public static final String EXTRA_PASSWORD_IDS = "fr.juliette.thecode.autofill.PASSWORD_IDS";
    /**
     * Identifiant saisi dans la page, pour un compte que le carnet ne connaît
     * pas encore : il entre dans la dérivation. Absent, le repli dérive sans.
     */
    public static final String EXTRA_LOGIN = "fr.juliette.thecode.autofill.LOGIN";
    /**
     * Champ identifiant du formulaire, rempli avec l'identifiant du compte
     * choisi selon {@link UsernameFill}.
     */
    public static final String EXTRA_USERNAME_ID = "fr.juliette.thecode.autofill.USERNAME_ID";
    /** Valeur du champ identifiant au moment de la suggestion. */
    public static final String EXTRA_PAGE_LOGIN = "fr.juliette.thecode.autofill.PAGE_LOGIN";
    /**
     * Compte inconnu du carnet et aucun identifiant lu dans la page : on le
     * demande avant de calculer, puisqu'il entre dans le mot de passe.
     */
    public static final String EXTRA_ASK_LOGIN = "fr.juliette.thecode.autofill.ASK_LOGIN";

    private String domain;
    private String entryId;
    private AutofillId[] passwordIds;
    @Nullable
    private String pageLogin;
    @Nullable
    private AutofillId usernameId;
    @Nullable
    private String typedLogin;
    private boolean askLogin;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_autofill_auth);

        Intent intent = getIntent();
        domain = intent.getStringExtra(EXTRA_DOMAIN);
        entryId = intent.getStringExtra(EXTRA_ENTRY_ID);
        passwordIds = readAutofillIds(intent.getParcelableArrayExtra(EXTRA_PASSWORD_IDS));
        pageLogin = intent.getStringExtra(EXTRA_LOGIN);
        typedLogin = intent.getStringExtra(EXTRA_PAGE_LOGIN);
        Parcelable username = intent.getParcelableExtra(EXTRA_USERNAME_ID);
        usernameId = username instanceof AutofillId ? (AutofillId) username : null;

        if (domain == null || passwordIds == null || passwordIds.length == 0) {
            cancelAndFinish();
            return;
        }

        askLogin = intent.getBooleanExtra(EXTRA_ASK_LOGIN, false);
        promptBiometric();
    }

    /**
     * Authentifié : rien du carnet n'est montré avant, pas même les
     * identifiants proposés, qui viennent d'autres sites.
     */
    private void afterAuthentication() {
        if (askLogin) askLogin();
        else fillAndFinish();
    }

    /**
     * Demande l'identifiant du compte. « Ignorer » calcule sans : c'est un
     * choix, pas un champ laissé vide.
     */
    private void askLogin() {
        EditText field = new EditText(this);
        field.setHint(R.string.autofill_ask_login_hint);
        field.setSingleLine(true);
        field.setInputType(InputType.TYPE_CLASS_TEXT
                | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
                | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        // Ce champ est le nôtre : le remplissage automatique n'a rien à y faire.
        field.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);
        int margin = Math.round(20 * getResources().getDisplayMetrics().density);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(margin, margin / 2, margin, 0);
        box.addView(field);

        // Les identifiants déjà au carnet, d'un geste : c'est le plus souvent
        // l'un d'eux.
        LinearLayout suggestions = new LinearLayout(this);
        suggestions.setOrientation(LinearLayout.VERTICAL);
        for (String login : LoginSuggestions.of(Vault.load(this), domain,
                LoginSuggestions.DEFAULT_LIMIT)) {
            Button suggestion = new Button(this, null, android.R.attr.borderlessButtonStyle);
            suggestion.setText(login);
            suggestion.setAllCaps(false);
            suggestion.setOnClickListener(v -> {
                field.setText(login);
                field.setSelection(login.length());
            });
            suggestions.addView(suggestion);
        }
        box.addView(suggestions);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(getString(R.string.autofill_ask_login_title, domain))
                .setMessage(R.string.autofill_ask_login_message)
                .setView(box)
                .setPositiveButton(R.string.autofill_ask_login_fill, (d, which) -> {
                    pageLogin = SiteResolution.normalizeLogin(field.getText().toString());
                    TypedLoginHint.remember(domain, pageLogin, SystemClock.elapsedRealtime());
                    fillAndFinish();
                })
                .setNeutralButton(R.string.autofill_ask_login_skip, (d, which) -> {
                    TypedLoginHint.forget();
                    fillAndFinish();
                })
                .setNegativeButton(android.R.string.cancel, (d, which) -> cancelAndFinish())
                .setOnCancelListener(d -> cancelAndFinish())
                .create();
        dialog.setOnShowListener(d -> {
            Button fill = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
            fill.setEnabled(false);
            field.addTextChangedListener(new TextWatcher() {
                @Override
                public void beforeTextChanged(CharSequence s, int start, int count, int after) { }

                @Override
                public void onTextChanged(CharSequence s, int start, int before, int count) { }

                @Override
                public void afterTextChanged(Editable s) {
                    fill.setEnabled(!s.toString().trim().isEmpty());
                }
            });
            field.requestFocus();
        });
        if (dialog.getWindow() != null) {
            dialog.getWindow().setSoftInputMode(
                    WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
        }
        dialog.show();
    }

    private void promptBiometric() {
        // Combiner biométrie + code PIN n'est autorisé qu'à partir d'Android 11.
        // Sur les versions précédentes on se contente de la biométrie.
        boolean canMixCredential = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R;
        int auth = canMixCredential
                ? (BiometricManager.Authenticators.BIOMETRIC_WEAK
                    | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                : BiometricManager.Authenticators.BIOMETRIC_WEAK;

        BiometricManager bm = BiometricManager.from(this);
        if (bm.canAuthenticate(auth) != BiometricManager.BIOMETRIC_SUCCESS) {
            // Aucune méthode d'auth disponible : l'utilisateur a déjà déverrouillé
            // son appareil pour atteindre ce point — on remplit directement.
            afterAuthentication();
            return;
        }

        BiometricPrompt prompt = new BiometricPrompt(this,
                ContextCompat.getMainExecutor(this),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        afterAuthentication();
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        cancelAndFinish();
                    }
                });

        BiometricPrompt.PromptInfo.Builder infoBuilder = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(getString(R.string.autofill_auth_title))
                .setSubtitle(getString(R.string.autofill_for_domain, domain))
                .setAllowedAuthenticators(auth);
        if (!canMixCredential) {
            infoBuilder.setNegativeButtonText(getString(android.R.string.cancel));
        }
        prompt.authenticate(infoBuilder.build());
    }

    private void fillAndFinish() {
        Preferences prefs = new Preferences(this);
        String key = prefs.getEncodingKey();
        if (key.isEmpty()) {
            cancelAndFinish();
            return;
        }

        // Le carnet est relu ici plutôt que transporté par l'Intent : une
        // synchronisation a pu passer entre la suggestion et la validation, et
        // les réglages n'ont pas à transiter par un Intent.
        SiteResolution resolution = SiteResolution.byId(Vault.load(this), entryId, domain,
                pageLogin, prefs.getLength(), prefs.getMinState(), prefs.getMajState(),
                prefs.getSymState(), prefs.getChiState());

        // Toujours en v2, repli compris : le remplissage ne propose pas de
        // choix, il doit être prévisible. Un site encore en v1 se génère
        // depuis l'écran principal.
        String password = Generator.generate(resolution, key, null, 2);
        if (password.isEmpty()) {
            cancelAndFinish();
            return;
        }

        Dataset dataset = buildDataset(password, resolution);

        Intent reply = new Intent();
        reply.putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, dataset);
        // Éphémère : le système applique ce Dataset une fois et garde la
        // suggestion d'origine. Sinon il la remplace par celui-ci, qui n'a pas
        // de présentation pour la barre du clavier : champ vidé puis retouché,
        // plus rien n'était proposé avant de recharger la page.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            reply.putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT_EPHEMERAL_DATASET, true);
        }
        setResult(RESULT_OK, reply);
        finish();
    }

    private Dataset buildDataset(String password, SiteResolution resolution) {
        RemoteViews presentation = new RemoteViews(getPackageName(), R.layout.autofill_item);
        presentation.setTextViewText(R.id.autofill_title, getString(R.string.app_name));
        presentation.setTextViewText(R.id.autofill_subtitle,
                getString(R.string.autofill_for_domain, domain));

        // L'API « Field + Presentations » de TIRAMISU+ refusait silencieusement
        // d'appliquer le Dataset sur certaines surfaces autofill. L'API
        // historique reste supportée sur toutes les versions et fonctionne
        // de façon fiable.
        @SuppressWarnings("deprecation")
        Dataset.Builder builder = new Dataset.Builder(presentation);
        for (AutofillId id : passwordIds) {
            builder.setValue(id, AutofillValue.forText(password));
        }
        // Le formulaire soumis doit porter l'identifiant qui redonne le mot de
        // passe : celui du compte, écrit si le champ est vide ou le porte déjà
        // (nouveau compte dérivé avec l'identifiant de la page compris). Un
        // autre identifiant tapé reste en place.
        String login = usernameId != null ? UsernameFill.loginToFill(resolution, typedLogin) : null;
        if (login != null) {
            builder.setValue(usernameId, AutofillValue.forText(login));
        }
        return builder.build();
    }

    private void cancelAndFinish() {
        setResult(RESULT_CANCELED);
        finish();
    }

    private static AutofillId[] readAutofillIds(Parcelable[] source) {
        if (source == null) return null;
        AutofillId[] ids = new AutofillId[source.length];
        for (int i = 0; i < source.length; i++) {
            if (source[i] instanceof AutofillId) {
                ids[i] = (AutofillId) source[i];
            } else {
                return null;
            }
        }
        return ids;
    }
}
