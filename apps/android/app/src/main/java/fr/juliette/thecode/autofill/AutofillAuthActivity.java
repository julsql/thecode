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

import fr.juliette.thecode.Code;
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
    public static final String EXTRA_PASSWORD_IDS = "fr.juliette.thecode.autofill.PASSWORD_IDS";

    private String domain;
    private AutofillId[] passwordIds;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_autofill_auth);

        Intent intent = getIntent();
        domain = intent.getStringExtra(EXTRA_DOMAIN);
        passwordIds = readAutofillIds(intent.getParcelableArrayExtra(EXTRA_PASSWORD_IDS));

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

        Code code = new Code();
        code.setMinState(prefs.getMinState());
        code.setMajState(prefs.getMajState());
        code.setSymState(prefs.getSymState());
        code.setChiState(prefs.getChiState());
        code.setLength(prefs.getLength());

        String password = code.getCode(key, domain);
        if (password.isEmpty()) {
            cancelAndFinish();
            return;
        }

        Dataset dataset = buildDataset(password);

        Intent reply = new Intent();
        reply.putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, dataset);
        setResult(RESULT_OK, reply);
        finish();
    }

    private Dataset buildDataset(String password) {
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
