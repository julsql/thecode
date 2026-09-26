package fr.juliette.thecode.autofill;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Parcelable;
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
    /** Champ identifiant du formulaire, rempli avec {@link #EXTRA_LOGIN}. */
    public static final String EXTRA_USERNAME_ID = "fr.juliette.thecode.autofill.USERNAME_ID";

    private String domain;
    private String entryId;
    private AutofillId[] passwordIds;
    @Nullable
    private String pageLogin;
    @Nullable
    private AutofillId usernameId;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_autofill_auth);

        Intent intent = getIntent();
        domain = intent.getStringExtra(EXTRA_DOMAIN);
        entryId = intent.getStringExtra(EXTRA_ENTRY_ID);
        passwordIds = readAutofillIds(intent.getParcelableArrayExtra(EXTRA_PASSWORD_IDS));
        pageLogin = intent.getStringExtra(EXTRA_LOGIN);
        Parcelable username = intent.getParcelableExtra(EXTRA_USERNAME_ID);
        usernameId = username instanceof AutofillId ? (AutofillId) username : null;

        if (domain == null || passwordIds == null || passwordIds.length == 0) {
            cancelAndFinish();
            return;
        }

        promptBiometric();
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
            fillAndFinish();
            return;
        }

        BiometricPrompt prompt = new BiometricPrompt(this,
                ContextCompat.getMainExecutor(this),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        fillAndFinish();
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
        // Mot de passe dérivé avec l'identifiant de la page : on remet cet
        // identifiant dans son champ (valeur inchangée), pour que le formulaire
        // soumis porte celui qui redonne le mot de passe.
        if (usernameId != null && resolution.entryId.isEmpty() && !resolution.login.isEmpty()) {
            builder.setValue(usernameId, AutofillValue.forText(resolution.login));
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
