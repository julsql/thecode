package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.json.JSONObject;
import org.junit.Test;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** « Continuer avec Google » : ce qui part au service et ce qu'on en garde. */
public class GoogleSignInTest {

    private static final String ENDPOINT = "https://example.test/api";

    /** Transport qui note chaque appel et rend une réponse fixe. */
    private static final class Recorder implements Sync.Http {
        final List<String> urls = new ArrayList<>();
        final List<String> methods = new ArrayList<>();
        final List<String> bodies = new ArrayList<>();
        final Sync.Response response;

        Recorder(int status, String body) {
            this.response = new Sync.Response(status, body);
        }

        @Override
        public Sync.Response send(String url, String method, String body, String bearer) {
            urls.add(url);
            methods.add(method);
            bodies.add(body);
            return response;
        }
    }

    // ------------------------------------------------------- registration

    @Test
    public void readsTheGoogleClientId() throws Exception {
        Recorder http = new Recorder(200,
                "{\"open\":true,\"needsCode\":false,\"freeSlots\":null,"
                        + "\"googleClientId\":\"123-web.apps.googleusercontent.com\"}");

        assertEquals("123-web.apps.googleusercontent.com",
                new Sync(http).googleClientId(ENDPOINT));
        assertEquals(ENDPOINT + "/v1/auth/registration", http.urls.get(0));
        assertEquals("GET", http.methods.get(0));
    }

    @Test
    public void noClientIdWhenAbsentNullOrBlank() throws Exception {
        assertNull(Sync.parseGoogleClientId(new JSONObject("{\"open\":true}")));
        assertNull(Sync.parseGoogleClientId(new JSONObject("{\"googleClientId\":null}")));
        assertNull(Sync.parseGoogleClientId(new JSONObject("{\"googleClientId\":\"  \"}")));
    }

    @Test
    public void registrationFailureIsReported() {
        Sync sync = new Sync((url, method, body, bearer) -> {
            throw new IOException("offline");
        });
        try {
            sync.googleClientId(ENDPOINT);
            fail("un service injoignable doit lever");
        } catch (Sync.SyncException expected) {
            assertEquals(0, expected.status);
        }
    }

    // ------------------------------------------------------- auth/google

    @Test
    public void sendsTheIdTokenAndKeepsTheTokens() throws Exception {
        Recorder http = new Recorder(200,
                "{\"access_token\":\"a\",\"refresh_token\":\"r\","
                        + "\"token_type\":\"bearer\",\"expires_in\":900}");

        Sync.Credentials creds = new Sync(http)
                .googleSignIn(ENDPOINT, "id-token", "Pixel", "fr", "");

        assertEquals(ENDPOINT + "/v1/auth/google", http.urls.get(0));
        assertEquals("POST", http.methods.get(0));
        JSONObject body = new JSONObject(http.bodies.get(0));
        assertEquals("id-token", body.getString("id_token"));
        assertEquals("Pixel", body.getString("device_label"));
        assertEquals("fr", body.getString("lang"));
        assertFalse(body.has("invite_code"));

        assertEquals(ENDPOINT, creds.endpoint);
        assertEquals("a", creds.accessToken);
        assertEquals("r", creds.refreshToken);
        assertEquals(Sync.PLAN_FREE, creds.plan);
    }

    @Test
    public void sendsTheInviteCodeWhenGiven() throws Exception {
        Recorder http = new Recorder(200, "{\"access_token\":\"a\",\"refresh_token\":\"r\"}");
        new Sync(http).googleSignIn(ENDPOINT, "id-token", "Pixel", "en", "CODE-1");
        assertEquals("CODE-1", new JSONObject(http.bodies.get(0)).getString("invite_code"));
    }

    @Test
    public void refusedTokenSurfacesStatusAndDetail() {
        Recorder http = new Recorder(401, "{\"detail\":\"Connexion Google refusée.\"}");
        try {
            new Sync(http).googleSignIn(ENDPOINT, "forged", "Pixel", "en", "");
            fail("un jeton refusé doit lever");
        } catch (Sync.SyncException e) {
            assertEquals(401, e.status);
            assertTrue(e.getMessage(), e.getMessage().contains("Connexion Google refusée."));
        }
    }

    @Test
    public void googleCredentialsSyncLikePasswordOnes() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        Sync sync = new Sync(server);
        Sync.Credentials creds = sync.googleSignIn(ENDPOINT, "id-token", "Pixel", "en", "");

        Vault vault = new Vault();
        vault.entries.add(VaultEntry.create("exemple.fr",
                Collections.singletonList("exemple.fr")));
        Sync.Result result = sync.syncRenewing(vault, "clef", creds);

        assertEquals(1, result.vault.entries.size());
        assertEquals(1, server.revision);
    }

    @Test
    public void serviceLangIsFrenchOrEnglish() {
        assertEquals("fr", Sync.serviceLang("fr"));
        assertEquals("en", Sync.serviceLang("de"));
        assertEquals("en", Sync.serviceLang(null));
    }
}
