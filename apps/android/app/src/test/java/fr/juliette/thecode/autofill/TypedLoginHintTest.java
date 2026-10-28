package fr.juliette.thecode.autofill;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.After;
import org.junit.Test;

/** Identifiant saisi dans la fenêtre du remplissage, gardé jusqu'à l'envoi du formulaire. */
public class TypedLoginHintTest {

    private static final long T0 = 1_000_000;

    @After
    public void forget() {
        TypedLoginHint.forget();
    }

    @Test
    public void recallsTheLoginTypedForTheSite() {
        TypedLoginHint.remember("example.com", "alice", T0);
        assertEquals("alice", TypedLoginHint.recall("example.com", T0 + TypedLoginHint.VALID_MS));
    }

    @Test
    public void forgetsItForAnotherSiteOrLater() {
        TypedLoginHint.remember("example.com", "alice", T0);
        assertNull(TypedLoginHint.recall("autre.fr", T0));
        assertNull(TypedLoginHint.recall("example.com", T0 + TypedLoginHint.VALID_MS + 1));
        assertNull(TypedLoginHint.recall("example.com", T0 - 1));
    }

    @Test
    public void skippingForgetsAnEarlierLogin() {
        TypedLoginHint.remember("example.com", "alice", T0);
        TypedLoginHint.forget();
        assertNull(TypedLoginHint.recall("example.com", T0));
    }

    @Test
    public void nothingToRecallAtFirst() {
        assertNull(TypedLoginHint.recall("example.com", T0));
    }
}
