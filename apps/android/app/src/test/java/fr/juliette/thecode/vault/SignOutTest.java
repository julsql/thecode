package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

public class SignOutTest {

    private static final Sync.Credentials CREDS =
            new Sync.Credentials("https://example.test/api", "access-1", "refresh-7");

    /** Transport qui enregistre chaque appel et rend une réponse choisie. */
    private static final class Recorder implements Sync.Http {
        final List<String[]> calls = new ArrayList<>();
        final List<String> events;
        int status = 204;
        boolean unreachable = false;

        Recorder(List<String> events) {
            this.events = events;
        }

        @Override
        public Sync.Response send(String url, String method, String body, String bearer)
                throws IOException {
            calls.add(new String[] {url, method, body, bearer});
            events.add("logout");
            if (unreachable) throw new IOException("réseau coupé");
            return new Sync.Response(status, "");
        }
    }

    @Test
    public void logoutSendsTheRefreshTokenToTheLogoutRoute() throws Exception {
        Recorder http = new Recorder(new ArrayList<>());

        assertTrue(new Sync(http).logout(CREDS));

        assertEquals(1, http.calls.size());
        String[] call = http.calls.get(0);
        assertEquals("https://example.test/api/v1/auth/logout", call[0]);
        assertEquals("POST", call[1]);
        assertEquals("refresh-7", new JSONObject(call[2]).getString("refresh_token"));
        assertNull(call[3]);
    }

    @Test
    public void logoutDoesNotRenewTheTokenOnARejection() {
        Recorder http = new Recorder(new ArrayList<>());
        http.status = 401;

        assertFalse(new Sync(http).logout(CREDS));
        assertEquals(1, http.calls.size());
    }

    @Test
    public void signOutRevokesThenForgetsTheSession() {
        List<String> events = new ArrayList<>();
        Recorder http = new Recorder(events);

        new Sync(http).signOut(CREDS, () -> events.add("forget"));

        assertEquals(2, events.size());
        assertEquals("logout", events.get(0));
        assertEquals("forget", events.get(1));
    }

    @Test
    public void signOutForgetsTheSessionWhenTheServiceIsUnreachable() {
        Recorder http = new Recorder(new ArrayList<>());
        http.unreachable = true;
        AtomicBoolean forgotten = new AtomicBoolean(false);

        new Sync(http).signOut(CREDS, () -> forgotten.set(true));

        assertEquals(1, http.calls.size());
        assertTrue(forgotten.get());
    }

    @Test
    public void signOutForgetsTheSessionWhenTheServiceFails() {
        Recorder http = new Recorder(new ArrayList<>());
        http.status = 500;
        AtomicBoolean forgotten = new AtomicBoolean(false);

        new Sync(http).signOut(CREDS, () -> forgotten.set(true));

        assertEquals(1, http.calls.size());
        assertTrue(forgotten.get());
    }
}
