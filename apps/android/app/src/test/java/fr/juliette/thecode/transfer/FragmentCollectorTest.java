package fr.juliette.thecode.transfer;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;

import org.junit.Test;

import java.util.List;

import fr.juliette.thecode.vault.Transfer;

/**
 * Assemblage des QR lus.
 *
 * Les codes defilent en boucle : l'ordre ne doit pas compter, et un code
 * etranger ne doit pas interrompre la lecture.
 */
public class FragmentCollectorTest {

    @Test
    public void acceptsASingleCodeDirectly() {
        assertEquals("TC2.sel.nonce.donnees", new FragmentCollector().accept("TC2.sel.nonce.donnees"));
    }

    @Test
    public void handsAVersionOneCodeOverSoTheImportRefusesIt() {
        // TC1 n'est plus lu : le rendre à l'import, qui le refuse en le
        // disant, vaut mieux que d'attendre en silence un code qui ne vient pas.
        FragmentCollector collector = new FragmentCollector();
        String v1 = "TC1.nonce.donnees";
        assertEquals(v1, collector.accept(v1));
        assertThrows(Transfer.TransferException.class, () -> Transfer.importVault(v1, "clef"));
        assertEquals("TC1m.0.2.aaa", collector.accept("TC1m.0.2.aaa"));
        assertEquals(0, collector.seenCount());
    }

    @Test
    public void ignoresAForeignCode() {
        // La camera vise peut-etre encore : se plaindre serait premature.
        FragmentCollector collector = new FragmentCollector();
        assertNull(collector.accept("https://example.fr"));
        assertEquals(0, collector.seenCount());
    }

    @Test
    public void rejoinsFragmentsInAnyOrder() {
        StringBuilder body = new StringBuilder();
        for (int i = 0; i < 7000; i++) body.append('A');
        String payload = "TC2." + body;
        List<String> parts = Transfer.fragments(payload);

        FragmentCollector collector = new FragmentCollector();
        String result = null;
        for (int i = parts.size() - 1; i >= 0; i--) {
            result = collector.accept(parts.get(i));
        }

        assertEquals(payload, result);
    }

    @Test
    public void rendersNothingWhileOneIsMissing() {
        FragmentCollector collector = new FragmentCollector();
        assertNull(collector.accept("TC2m.0.3.aaa"));
        assertNull(collector.accept("TC2m.2.3.ccc"));

        // Un carnet incomplet s'importerait a moitie : pire que rien.
        assertEquals(2, collector.seenCount());
        assertEquals(3, collector.expected());
    }

    @Test
    public void aRepeatedFragmentChangesNothing() {
        FragmentCollector collector = new FragmentCollector();
        collector.accept("TC2m.0.2.aaa");
        collector.accept("TC2m.0.2.aaa");

        assertEquals(1, collector.seenCount());
        assertEquals("TC2.aaabbb", collector.accept("TC2m.1.2.bbb"));
    }

    @Test
    public void ignoresAnOutOfRangeIndex() {
        // Un code abime ou fabrique ne doit pas corrompre l'assemblage.
        FragmentCollector collector = new FragmentCollector();
        assertNull(collector.accept("TC2m.5.2.xxx"));
        assertEquals(0, collector.seenCount());
    }
}
