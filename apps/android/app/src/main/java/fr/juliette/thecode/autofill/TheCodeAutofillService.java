package fr.juliette.thecode.autofill;

import android.app.PendingIntent;
import android.app.assist.AssistStructure;
import android.content.Intent;
import android.content.IntentSender;
import android.os.Build;
import android.os.CancellationSignal;
import android.service.autofill.AutofillService;
import android.service.autofill.Dataset;
import android.service.autofill.FillCallback;
import android.service.autofill.FillContext;
import android.service.autofill.FillRequest;
import android.service.autofill.FillResponse;
import android.service.autofill.SaveCallback;
import android.service.autofill.SaveRequest;
import android.view.autofill.AutofillId;
import android.widget.RemoteViews;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;

import java.util.List;

import fr.juliette.thecode.Preferences;
import fr.juliette.thecode.R;

/**
 * Service Android Autofill : sur chaque champ « mot de passe » détecté,
 * propose une entrée « TheCode pour {domaine} ». Une authentification
 * biométrique est requise avant que la valeur ne soit générée et insérée.
 */
@RequiresApi(Build.VERSION_CODES.O)
public class TheCodeAutofillService extends AutofillService {

    @Override
    public void onFillRequest(@NonNull FillRequest request,
                              @NonNull CancellationSignal cancellationSignal,
                              @NonNull FillCallback callback) {

        Preferences prefs = new Preferences(this);
        if (prefs.getEncodingKey().isEmpty()) {
            callback.onSuccess(null);
            return;
        }

        List<FillContext> contexts = request.getFillContexts();
        if (contexts.isEmpty()) {
            callback.onSuccess(null);
            return;
        }
        AssistStructure structure = contexts.get(contexts.size() - 1).getStructure();
        String activityPackage = structure.getActivityComponent() != null
                ? structure.getActivityComponent().getPackageName()
                : getPackageName();

        // On ne se propose pas à nous-mêmes : la clé n'est pas un mot de passe
        // de site, c'est le secret maître.
        if (getPackageName().equals(activityPackage)) {
            callback.onSuccess(null);
            return;
        }

        ParsedStructure parsed = StructureParser.parse(structure, activityPackage);
        if (!parsed.hasPasswordFields()) {
            callback.onSuccess(null);
            return;
        }

        String domain = DomainNormalizer.normalize(parsed.domain, parsed.isPackage);
        if (domain.isEmpty()) {
            callback.onSuccess(null);
            return;
        }

        AutofillId[] ids = parsed.passwordIds.toArray(new AutofillId[0]);
        FillResponse response = buildAuthenticatedResponse(domain, ids);
        callback.onSuccess(response);
    }

    @Override
    public void onSaveRequest(@NonNull SaveRequest request, @NonNull SaveCallback callback) {
        // Aucune sauvegarde : les mots de passe sont entièrement déterministes.
        callback.onSuccess();
    }

    private FillResponse buildAuthenticatedResponse(String domain, AutofillId[] passwordIds) {
        RemoteViews presentation = buildPresentation(domain);

        Intent authIntent = new Intent(this, AutofillAuthActivity.class);
        authIntent.putExtra(AutofillAuthActivity.EXTRA_DOMAIN, domain);
        authIntent.putExtra(AutofillAuthActivity.EXTRA_PASSWORD_IDS, passwordIds);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_MUTABLE;
        }
        PendingIntent pending = PendingIntent.getActivity(this,
                domain.hashCode(), authIntent, flags);
        IntentSender sender = pending.getIntentSender();

        // Authentification au niveau du Dataset (et non du FillResponse) :
        // après auth, on renvoie un Dataset déjà rempli, et le système
        // l'applique en un seul tap. Avec une auth FillResponse-level, le
        // framework attendait un FillResponse en retour et ignorait notre
        // Dataset (champ silencieusement non rempli).
        @SuppressWarnings("deprecation")
        Dataset.Builder datasetBuilder = new Dataset.Builder(presentation);
        datasetBuilder.setAuthentication(sender);
        for (AutofillId id : passwordIds) {
            datasetBuilder.setValue(id, null);
        }

        return new FillResponse.Builder()
                .addDataset(datasetBuilder.build())
                .build();
    }

    private RemoteViews buildPresentation(String domain) {
        RemoteViews views = new RemoteViews(getPackageName(), R.layout.autofill_item);
        views.setTextViewText(R.id.autofill_title, getString(R.string.app_name));
        views.setTextViewText(R.id.autofill_subtitle,
                getString(R.string.autofill_for_domain, domain));
        return views;
    }
}
