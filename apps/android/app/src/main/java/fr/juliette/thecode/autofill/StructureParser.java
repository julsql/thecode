package fr.juliette.thecode.autofill;

import android.app.assist.AssistStructure;
import android.os.Build;
import android.text.InputType;
import android.text.TextUtils;
import android.view.View;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillValue;

import androidx.annotation.RequiresApi;

/**
 * Parcours récursif d'une AssistStructure pour identifier le domaine cible
 * et les champs de mot de passe à remplir.
 */
@RequiresApi(Build.VERSION_CODES.O)
final class StructureParser {

    private StructureParser() {}

    static ParsedStructure parse(AssistStructure structure, String fallbackPackage) {
        ParsedStructure parsed = new ParsedStructure(fallbackPackage, true);
        // Domaine associé au champ mot de passe via sa chaîne d'ancêtres :
        // c'est la seule manière fiable d'éviter qu'un nœud d'UI sans rapport
        // (suggestions, raccourcis, barre d'URL d'un navigateur) impose son
        // propre webDomain — ex. Firefox qui expose mozilla.org dans son chrome.
        String[] passwordDomain = new String[1];
        String[] fallbackDomain = new String[1];

        int windowCount = structure.getWindowNodeCount();
        for (int i = 0; i < windowCount; i++) {
            AssistStructure.WindowNode window = structure.getWindowNodeAt(i);
            AssistStructure.ViewNode root = window.getRootViewNode();
            traverse(root, parsed, null, passwordDomain, fallbackDomain);
        }

        String webDomain = passwordDomain[0] != null ? passwordDomain[0] : fallbackDomain[0];
        if (webDomain != null && !webDomain.isEmpty()) {
            parsed = relocate(parsed, webDomain, false);
        }
        return parsed;
    }

    private static ParsedStructure relocate(ParsedStructure src, String newDomain, boolean isPackage) {
        ParsedStructure copy = new ParsedStructure(newDomain, isPackage);
        copy.passwordIds.addAll(src.passwordIds);
        copy.usernameId = src.usernameId;
        copy.usernameValue = src.usernameValue;
        copy.passwordValue = src.passwordValue;
        return copy;
    }

    private static void traverse(AssistStructure.ViewNode node,
                                 ParsedStructure parsed,
                                 String inheritedDomain,
                                 String[] passwordDomain,
                                 String[] fallbackDomain) {
        if (node == null) return;

        String currentDomain = inheritedDomain;
        String nodeDomain = node.getWebDomain();
        if (nodeDomain != null && !nodeDomain.isEmpty()) {
            currentDomain = nodeDomain;
            if (fallbackDomain[0] == null) fallbackDomain[0] = nodeDomain;
        }

        if (isPasswordField(node)) {
            AutofillId id = node.getAutofillId();
            if (id != null) parsed.passwordIds.add(id);
            if (passwordDomain[0] == null && currentDomain != null) {
                passwordDomain[0] = currentDomain;
            }
            if (parsed.passwordValue == null) parsed.passwordValue = textValue(node);
        } else if (isUsernameField(node)) {
            // Le premier seulement : un formulaire en porte rarement deux, et
            // une barre de recherche plus bas ne doit pas passer pour lui.
            if (parsed.usernameId == null) {
                parsed.usernameId = node.getAutofillId();
                parsed.usernameValue = textValue(node);
            }
        }

        int children = node.getChildCount();
        for (int i = 0; i < children; i++) {
            traverse(node.getChildAt(i), parsed, currentDomain, passwordDomain, fallbackDomain);
        }
    }

    private static boolean isPasswordField(AssistStructure.ViewNode node) {
        if (node.getAutofillType() != View.AUTOFILL_TYPE_TEXT) return false;

        String[] hints = node.getAutofillHints();
        if (hints != null) {
            for (String hint : hints) {
                if (hint == null) continue;
                String h = hint.toLowerCase();
                if (h.contains("password")) return true;
            }
        }

        int inputType = node.getInputType();
        int variation = inputType & InputType.TYPE_MASK_VARIATION;
        int klass = inputType & InputType.TYPE_MASK_CLASS;
        if (klass == InputType.TYPE_CLASS_TEXT) {
            if (variation == InputType.TYPE_TEXT_VARIATION_PASSWORD
                    || variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD
                    || variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD) {
                return true;
            }
        }
        if (klass == InputType.TYPE_CLASS_NUMBER
                && variation == InputType.TYPE_NUMBER_VARIATION_PASSWORD) {
            return true;
        }

        CharSequence hint = node.getHint();
        CharSequence idEntry = node.getIdEntry();
        return matchesPasswordKeyword(hint) || matchesPasswordKeyword(idEntry);
    }

    /** Texte saisi dans le champ, ou null s'il est vide ou non textuel. */
    private static String textValue(AssistStructure.ViewNode node) {
        AutofillValue value = node.getAutofillValue();
        if (value == null || !value.isText()) return null;
        String text = value.getTextValue().toString();
        return text.isEmpty() ? null : text;
    }

    private static boolean isUsernameField(AssistStructure.ViewNode node) {
        if (node.getAutofillType() != View.AUTOFILL_TYPE_TEXT) return false;

        String[] hints = node.getAutofillHints();
        if (hints != null) {
            for (String hint : hints) {
                if (hint == null) continue;
                String h = hint.toLowerCase();
                if (h.contains("username") || h.contains("email")) return true;
            }
        }

        int inputType = node.getInputType();
        int variation = inputType & InputType.TYPE_MASK_VARIATION;
        if ((inputType & InputType.TYPE_MASK_CLASS) == InputType.TYPE_CLASS_TEXT
                && (variation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
                    || variation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS)) {
            return true;
        }

        return matchesUsernameKeyword(node.getHint()) || matchesUsernameKeyword(node.getIdEntry());
    }

    /** Mots qui désignent un champ identifiant, en anglais et en français. */
    static boolean matchesUsernameKeyword(CharSequence value) {
        if (value == null || value.length() == 0) return false;
        String v = value.toString().toLowerCase();
        return v.contains("user") || v.contains("login") || v.contains("email")
                || v.contains("e-mail") || v.contains("identifiant")
                || v.contains("courriel") || v.contains("utilisateur");
    }

    private static boolean matchesPasswordKeyword(CharSequence value) {
        if (TextUtils.isEmpty(value)) return false;
        String v = value.toString().toLowerCase();
        return v.contains("password") || v.contains("passwd")
                || v.contains("mot de passe") || v.contains("motdepasse")
                || v.contains("mdp");
    }
}
