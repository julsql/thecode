package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Decoupage d'un carnet en plusieurs QR codes.
 *
 * Les codes defilent en boucle : on ne maitrise pas lequel est vu quand, donc
 * l'ordre ne doit pas compter et un fragment lu deux fois ne doit rien casser.
 */
public class TransferFragmentTest {

    @Test
    public void shortPayloadStaysWhole() {
        // Imposer un assemblage pour un carnet ordinaire n'apporterait rien.
        String payload = "TC1.abc.def";
        assertEquals(Collections.singletonList(payload), Transfer.fragments(payload));
    }

    @Test
    public void longPayloadIsSplit() {
        StringBuilder body = new StringBuilder();
        for (int i = 0; i < 7000; i++) body.append('A');
        String payload = "TC1." + body;

        List<String> parts = Transfer.fragments(payload);

        assertEquals(3, parts.size());
        for (String part : parts) {
            assertTrue(part, part.startsWith("TC1m."));
            assertTrue(part, part.length() <= Transfer.FRAGMENT_LIMIT + 16);
        }
    }

    @Test
    public void fragmentsRejoinInAnyOrder() {
        StringBuilder body = new StringBuilder();
        for (int i = 0; i < 7000; i++) body.append('B');
        String payload = "TC1." + body;

        List<String> parts = Transfer.fragments(payload);
        Map<Integer, String> seen = new HashMap<>();
        // A l'envers, et un fragment lu deux fois.
        for (int i = parts.size() - 1; i >= 0; i--) {
            String[] bits = parts.get(i).split("\\.", 4);
            seen.put(Integer.parseInt(bits[1]), bits[3]);
        }
        String[] repeat = parts.get(1).split("\\.", 4);
        seen.put(Integer.parseInt(repeat[1]), repeat[3]);

        assertEquals(payload, Transfer.assemble(seen, parts.size()));
    }

    @Test
    public void assemblingRendersNothingWhileOneIsMissing() {
        Map<Integer, String> partial = new HashMap<>();
        partial.put(0, "aaa");
        partial.put(2, "ccc");

        // Rendre un carnet incomplet serait pire que de ne rien rendre : il
        // s'importerait a moitie.
        assertNull(Transfer.assemble(partial, 3));
    }

    @Test
    public void aSplitVaultSurvivesTheRoundTrip() throws Exception {
        Vault big = new Vault();
        for (int i = 0; i < 120; i++) {
            VaultEntry entry = VaultEntry.create("site" + i + ".example.com", null);
            entry.login = "compte" + i + "@example.com";
            big.entries.add(entry);
        }

        String payload = Transfer.exportVault(big, "clef");
        List<String> parts = Transfer.fragments(payload);

        Map<Integer, String> seen = new HashMap<>();
        for (String part : parts) {
            String[] bits = part.split("\\.", 4);
            if (bits.length == 4) seen.put(Integer.parseInt(bits[1]), bits[3]);
        }

        String rebuilt = parts.size() > 1 ? Transfer.assemble(seen, parts.size()) : payload;
        assertEquals(120, Transfer.importVault(rebuilt, "clef").entries.size());
    }
}
