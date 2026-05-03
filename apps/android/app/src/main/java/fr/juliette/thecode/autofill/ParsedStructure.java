package fr.juliette.thecode.autofill;

import android.view.autofill.AutofillId;

import java.util.ArrayList;
import java.util.List;

/**
 * Résultat de l'analyse d'une AssistStructure :
 * - le domaine cible (web ou nom de package),
 * - la liste des champs « mot de passe » à remplir.
 */
final class ParsedStructure {
    final String domain;
    final boolean isPackage;
    final List<AutofillId> passwordIds;

    ParsedStructure(String domain, boolean isPackage) {
        this.domain = domain;
        this.isPackage = isPackage;
        this.passwordIds = new ArrayList<>();
    }

    boolean hasPasswordFields() {
        return !passwordIds.isEmpty();
    }
}
