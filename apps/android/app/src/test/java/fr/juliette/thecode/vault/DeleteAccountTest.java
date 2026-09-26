package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.json.JSONObject;
import org.junit.Test;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

public class DeleteAccountTest {

    private static final Sync.Credentials CREDS =
            new Sync.Credentials("https://example.test/api", "access-1", "refresh-7");

    /** Ce que l'utilisateur a saisi comme secret du compte : une valeur de test. */
    private static final String TYPED_SECRET = "typed-fixture";

    /** Transport qui enregistre chaque appel et rend les réponses prévues, dans l'ordre. */
    private static final class Scripted implements Sync.Http {
        final List<String[]> calls = new ArrayList<>();
        final Deque<Sync.Response> responses = new ArrayDeque<>();
        boolean unreachable = false;

        Scripted then(int status, String body) {
            responses.add(new Sync.Response(status, body));
            return this;
        }

        @Override
        public Sync.Response send(String url, String method, String body, String bearer)
                throws IOException {
            calls.add(new String[] {url, method, body, bearer});
            if (unreachable) throw new IOException("réseau coupé");
            Sync.Response next = responses.poll();
            return next == null ? new Sync.Response(500, "") : next;
        }
    }

    @Test
    public void deleteSendsTheTypedEmailAndSecretToTheAccountRoute() throws Exception {
        Scripted http = new Scripted().then(204, "");

        new Sync(http).deleteAccount(CREDS, "  Someone@Example.test ", TYPED_SECRET);

        assertEquals(1, http.calls.size());
        String[] call = http.calls.get(0);
        assertEquals("https://example.test/api/v1/account", call[0]);
        assertEquals("DELETE", call[1]);
        JSONObject body = new JSONObject(call[2]);
        assertEquals("Someone@Example.test", body.getString("confirm_email"));
        assertEquals(TYPED_SECRET, body.getString("password"));
        assertEquals("access-1", call[3]);
    }

    @Test
    public void deleteSendsAnEmptySecretForAnAccountWithout() throws Exception {
        Scripted http = new Scripted().then(204, "");

        new Sync(http).deleteAccount(CREDS, "someone@example.test", "");

        assertEquals("", new JSONObject(http.calls.get(0)[2]).getString("password"));
    }

    @Test
    public void deleteRenewsAnExpiredTokenThenRetries() throws Exception {
        Scripted http = new Scripted()
                .then(401, "{\"detail\":\"Jeton expiré\"}")
                .then(200, "{\"access_token\":\"access-2\",\"refresh_token\":\"refresh-8\"}")
                .then(204, "");

        new Sync(http).deleteAccount(CREDS, "someone@example.test", TYPED_SECRET);

        assertEquals(3, http.calls.size());
        assertEquals("https://example.test/api/v1/auth/refresh", http.calls.get(1)[0]);
        assertEquals("DELETE", http.calls.get(2)[1]);
        assertEquals("access-2", http.calls.get(2)[3]);
    }

    @Test
    public void deleteAndForgetForgetsTheSessionOnSuccess() throws Exception {
        Scripted http = new Scripted().then(204, "");
        AtomicBoolean forgotten = new AtomicBoolean(false);

        new Sync(http).deleteAccountAndForget(CREDS, "someone@example.test", TYPED_SECRET,
                () -> forgotten.set(true));

        assertTrue(forgotten.get());
    }

    @Test
    public void aWrongSecretKeepsTheSessionAndSaysSo() {
        Scripted http = new Scripted().then(403, "{\"detail\":\"Mot de passe incorrect.\"}");
        AtomicBoolean forgotten = new AtomicBoolean(false);

        Sync.SyncException error = deleteExpectingFailure(http, forgotten);

        assertFalse(forgotten.get());
        assertEquals(Sync.DeleteFailure.WRONG_PASSWORD, Sync.DeleteFailure.of(error));
    }

    @Test
    public void aMismatchedEmailKeepsTheSessionAndSaysSo() {
        Scripted http = new Scripted().then(400, "{\"detail\":\"L'adresse ne correspond pas.\"}");
        AtomicBoolean forgotten = new AtomicBoolean(false);

        Sync.SyncException error = deleteExpectingFailure(http, forgotten);

        assertFalse(forgotten.get());
        assertEquals(Sync.DeleteFailure.EMAIL_MISMATCH, Sync.DeleteFailure.of(error));
    }

    @Test
    public void anUnreachableServiceKeepsTheSession() {
        Scripted http = new Scripted();
        http.unreachable = true;
        AtomicBoolean forgotten = new AtomicBoolean(false);

        Sync.SyncException error = deleteExpectingFailure(http, forgotten);

        assertFalse(forgotten.get());
        assertEquals(Sync.DeleteFailure.UNREACHABLE, Sync.DeleteFailure.of(error));
    }

    @Test
    public void aServerFailureKeepsTheSession() {
        Scripted http = new Scripted().then(502, "{\"detail\":\"Réessayez dans un moment.\"}");
        AtomicBoolean forgotten = new AtomicBoolean(false);

        Sync.SyncException error = deleteExpectingFailure(http, forgotten);

        assertFalse(forgotten.get());
        assertEquals(Sync.DeleteFailure.OTHER, Sync.DeleteFailure.of(error));
    }

    @Test
    public void identityTellsTheEmailAndWhetherTheAccountHasASecret() throws Exception {
        Scripted http = new Scripted().then(200,
                "{\"email\":\"someone@example.test\",\"plan\":\"pro\",\"has_password\":false}");

        Sync.AccountIdentity identity = new Sync(http).accountIdentity(CREDS);

        assertEquals("https://example.test/api/v1/auth/me", http.calls.get(0)[0]);
        assertEquals("someone@example.test", identity.email);
        assertFalse(identity.hasPassword);
        assertEquals(Sync.PLAN_PRO, identity.credentials.plan);
    }

    @Test
    public void identityAsksForTheSecretWhenTheServiceDoesNotSay() throws Exception {
        Scripted http = new Scripted().then(200, "{\"email\":\"someone@example.test\"}");

        assertTrue(new Sync(http).accountIdentity(CREDS).hasPassword);
    }

    @Test
    public void identityRenewsAnExpiredToken() throws Exception {
        Scripted http = new Scripted()
                .then(401, "")
                .then(200, "{\"access_token\":\"access-2\",\"refresh_token\":\"refresh-8\"}")
                .then(200, "{\"email\":\"someone@example.test\",\"has_password\":true}");

        Sync.AccountIdentity identity = new Sync(http).accountIdentity(CREDS);

        assertEquals("access-2", identity.credentials.accessToken);
        assertEquals("refresh-8", identity.credentials.refreshToken);
    }

    @Test
    public void emailMatchIgnoresCaseAndSurroundingSpaces() {
        assertTrue(Sync.emailMatches(" Someone@Example.TEST ", "someone@example.test"));
        assertFalse(Sync.emailMatches("someone@example.tes", "someone@example.test"));
        assertFalse(Sync.emailMatches("", ""));
    }

    private static Sync.SyncException deleteExpectingFailure(Scripted http,
                                                              AtomicBoolean forgotten) {
        try {
            new Sync(http).deleteAccountAndForget(CREDS, "someone@example.test", TYPED_SECRET,
                    () -> forgotten.set(true));
        } catch (Sync.SyncException e) {
            return e;
        }
        fail("La suppression aurait dû échouer");
        return null;
    }
}
