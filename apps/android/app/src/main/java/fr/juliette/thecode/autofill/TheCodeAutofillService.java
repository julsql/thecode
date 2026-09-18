package fr.juliette.thecode.autofill;

import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.app.assist.AssistStructure;
import android.app.slice.Slice;
import android.content.Intent;
import android.content.IntentSender;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.CancellationSignal;
import android.service.autofill.AutofillService;
import android.service.autofill.Dataset;
import android.service.autofill.FillCallback;
import android.service.autofill.FillContext;
import android.service.autofill.FillRequest;
import android.service.autofill.FillResponse;
import android.service.autofill.InlinePresentation;
import android.service.autofill.SaveCallback;
import android.service.autofill.SaveRequest;
import android.view.autofill.AutofillId;
import android.view.inputmethod.InlineSuggestionsRequest;
import android.widget.RemoteViews;
import android.widget.inline.InlinePresentationSpec;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;
import androidx.autofill.inline.UiVersions;
import androidx.autofill.inline.v1.InlineSuggestionUi;

import java.util.List;

import fr.juliette.thecode.Preferences;
import fr.juliette.thecode.vault.SiteResolution;
import fr.juliette.thecode.vault.Vault;
import fr.juliette.thecode.R;

/**
 * Service Android Autofill : sur chaque champ « mot de passe » détecté,
 * propose une entrée « TheCode pour {domaine} ». Une authentification
 * biométrique est requise avant que la valeur ne soit générée et insérée.
 */
@RequiresApi(Build.VERSION_CODES.O)
public class TheCodeAutofillService extends AutofillService {

    @Override
    public void onCreate() {
        super.onCreate();
        // La Public Suffix List vit dans les assets : elle a besoin d'un
        // Context, donc on la charge ici plutot que dans un initialiseur
        // statique. Sans elle, DomainNormalizer refuse de canonicaliser.
        PublicSuffixList.load(this);
    }

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

        // Le carnet dit sous quelle clef dériver, avec quels réglages, et pour
        // lequel des comptes du site. Plusieurs entrées pour un même domaine,
        // c'est plusieurs comptes : on les propose toutes.
        List<SiteResolution> resolutions = SiteResolution.forDomain(
                Vault.load(this), domain, prefs.getLength(), prefs.getMinState(),
                prefs.getMajState(), prefs.getSymState(), prefs.getChiState());

        callback.onSuccess(buildAuthenticatedResponse(request, domain, resolutions, ids));
    }

    @Override
    public void onSaveRequest(@NonNull SaveRequest request, @NonNull SaveCallback callback) {
        // Aucune sauvegarde : les mots de passe sont entièrement déterministes.
        callback.onSuccess();
    }

    private FillResponse buildAuthenticatedResponse(FillRequest request, String domain,
                                                    List<SiteResolution> resolutions,
                                                    AutofillId[] passwordIds) {
        FillResponse.Builder response = new FillResponse.Builder();
        for (int i = 0; i < resolutions.size(); i++) {
            response.addDataset(buildDataset(request, domain, resolutions.get(i), i, passwordIds));
        }
        return response.build();
    }

    private Dataset buildDataset(FillRequest request, String domain, SiteResolution resolution,
                                 int index, AutofillId[] passwordIds) {
        RemoteViews presentation = buildPresentation(resolution.label);

        Intent authIntent = new Intent(this, AutofillAuthActivity.class);
        authIntent.putExtra(AutofillAuthActivity.EXTRA_DOMAIN, domain);
        authIntent.putExtra(AutofillAuthActivity.EXTRA_ENTRY_ID, resolution.entryId);
        authIntent.putExtra(AutofillAuthActivity.EXTRA_PASSWORD_IDS, passwordIds);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_MUTABLE;
        }
        // Code de requête distinct par suggestion : avec le même,
        // FLAG_UPDATE_CURRENT ferait pointer toutes les suggestions vers la
        // dernière, et chaque compte remplirait le mot de passe d'un autre.
        PendingIntent pending = PendingIntent.getActivity(this,
                domain.hashCode() * 31 + index, authIntent, flags);
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

        // Présentation inline (barre du clavier) quand le clavier la supporte
        // (Android 11+). On l'attache EN PLUS de la présentation RemoteViews :
        // le système choisit l'inline si dispo, sinon il retombe sur le dropdown.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            InlineSuggestionsRequest inlineRequest = request.getInlineSuggestionsRequest();
            if (inlineRequest != null) {
                InlinePresentation inline =
                        buildInlinePresentation(resolution.label, inlineRequest);
                if (inline != null) {
                    datasetBuilder.setInlinePresentation(inline);
                }
            }
        }

        return datasetBuilder.build();
    }

    /**
     * Construit la présentation inline à partir du premier spec fourni par le
     * clavier. Renvoie {@code null} si le clavier ne fournit aucun spec ou n'est
     * pas compatible avec le style inline v1 (auquel cas seul le dropdown s'affiche).
     */
    // InlineSuggestionUi.Content.getSlice() est marquee @RestrictTo dans
    // androidx.autofill alors que c'est le seul moyen documente d'obtenir le
    // Slice attendu par InlinePresentation. Faux positif connu du lint.
    @SuppressLint("RestrictedApi")
    @RequiresApi(Build.VERSION_CODES.R)
    @Nullable
    private InlinePresentation buildInlinePresentation(String label,
                                                       InlineSuggestionsRequest inlineRequest) {
        List<InlinePresentationSpec> specs = inlineRequest.getInlinePresentationSpecs();
        if (specs == null || specs.isEmpty()) {
            return null;
        }
        InlinePresentationSpec spec = specs.get(0);
        if (!UiVersions.getVersions(spec.getStyle()).contains(UiVersions.INLINE_UI_VERSION_1)) {
            return null;
        }

        // Intent lancé au long-press sur la suggestion (« attribution ») : requis
        // et obligatoirement immuable. On ouvre simplement l'app.
        Intent attribution = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (attribution == null) {
            attribution = new Intent();
        }
        // La méthode est déjà @RequiresApi(R), donc FLAG_IMMUTABLE (API 23) est
        // toujours disponible : pas besoin de le conditionner.
        PendingIntent attributionPending = PendingIntent.getActivity(this, 0, attribution,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Slice slice = InlineSuggestionUi.newContentBuilder(attributionPending)
                .setTitle(getString(R.string.app_name))
                .setSubtitle(getString(R.string.autofill_for_domain, label))
                .setStartIcon(Icon.createWithResource(this, R.mipmap.logo))
                .setContentDescription(getString(R.string.app_name))
                .build()
                .getSlice();

        return new InlinePresentation(slice, spec, false);
    }

    private RemoteViews buildPresentation(String label) {
        RemoteViews views = new RemoteViews(getPackageName(), R.layout.autofill_item);
        views.setTextViewText(R.id.autofill_title, getString(R.string.app_name));
        views.setTextViewText(R.id.autofill_subtitle,
                getString(R.string.autofill_for_domain, label));
        return views;
    }
}
