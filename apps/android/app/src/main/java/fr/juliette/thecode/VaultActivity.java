package fr.juliette.thecode;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.appbar.MaterialToolbar;

import fr.juliette.thecode.vault.Vault;
import fr.juliette.thecode.vault.VaultEntry;

import java.util.List;

/**
 * Écran du carnet.
 *
 * Le carnet ne contient aucun mot de passe : seulement de quoi rejouer une
 * dérivation. Cet écran sert à voir ce qui est enregistré et à retrouver quels
 * réglages s'appliquent à quel site — c'était précisément ce qu'on ne pouvait
 * plus savoir avant qu'il existe.
 */
public class VaultActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_vault);

        MaterialToolbar toolbar = findViewById(R.id.vaultToolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        render(Vault.load(this));
    }

    private void render(Vault vault) {
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

        LayoutInflater inflater = LayoutInflater.from(this);
        for (VaultEntry entry : entries) {
            View card = inflater.inflate(R.layout.vault_item, list, false);

            ((TextView) card.findViewById(R.id.entryLabel)).setText(label(entry));
            // String.join demande l'API 26 : on assemble a la main.
            StringBuilder domains = new StringBuilder();
            for (String domain : entry.domains) {
                if (domains.length() > 0) domains.append(", ");
                domains.append(domain);
            }
            ((TextView) card.findViewById(R.id.entryDomains)).setText(domains.toString());
            ((TextView) card.findViewById(R.id.entrySettings)).setText(
                    getString(R.string.vault_entry_settings,
                            entry.length, charsetSummary(entry), entry.v));

            list.addView(card);
        }
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
