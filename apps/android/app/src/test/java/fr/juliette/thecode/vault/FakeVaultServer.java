package fr.juliette.thecode.vault;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Serveur de carnet en mémoire, aux mêmes règles que l'API réelle.
 *
 * Il permet de vérifier ce qui compte vraiment : ce que l'appareil envoie sur
 * le réseau, et le fait que deux appareils convergent. Un vrai serveur ne
 * dirait rien de plus et rendrait les tests lents et instables.
 */
final class FakeVaultServer implements Sync.Http {

    private final Map<String, JSONObject> rows = new LinkedHashMap<>();
    int revision = 0;

    /** Tout ce qui est passé sur le réseau, pour vérifier l'absence de clair. */
    final List<String> sentBodies = new ArrayList<>();

    /** Jetons acceptés. Un jeton absent d'ici reçoit un 401, comme en vrai. */
    String validAccessToken = "access-1";
    String nextAccessToken = "access-2";
    int refreshCount = 0;

    @Override
    public Sync.Response send(String url, String method, String body, String bearer) {
        if (body != null) sentBodies.add(body);

        try {
            if (url.endsWith("/v1/auth/refresh")) {
                refreshCount++;
                validAccessToken = nextAccessToken;
                return json(200, new JSONObject()
                        .put("access_token", validAccessToken)
                        .put("refresh_token", "refresh-" + refreshCount));
            }
            if (url.endsWith("/v1/auth/login") || url.endsWith("/v1/auth/register")) {
                return json(200, new JSONObject()
                        .put("access_token", validAccessToken)
                        .put("refresh_token", "refresh-0"));
            }

            if (!validAccessToken.equals(bearer)) {
                return json(401, new JSONObject().put("detail", "Jeton expiré"));
            }
            return "GET".equals(method) ? pull() : push(new JSONObject(body));
        } catch (JSONException e) {
            throw new AssertionError(e);
        }
    }

    private Sync.Response pull() throws JSONException {
        JSONArray entries = new JSONArray();
        for (JSONObject row : rows.values()) entries.put(row);
        return json(200, new JSONObject().put("revision", revision).put("entries", entries));
    }

    private Sync.Response push(JSONObject payload) throws JSONException {
        if (payload.getInt("base_revision") != revision) {
            // Écraser reviendrait à perdre en silence ce qu'un autre appareil
            // a écrit entre-temps.
            return json(409, new JSONObject().put("detail",
                    "Le carnet a changé depuis (révision " + revision + ")"));
        }
        revision++;
        JSONArray entries = payload.getJSONArray("entries");
        for (int i = 0; i < entries.length(); i++) {
            JSONObject entry = entries.getJSONObject(i);
            rows.put(entry.getString("entry_id"), entry);
        }
        return json(200, new JSONObject().put("revision", revision)
                .put("accepted", entries.length()));
    }

    private static Sync.Response json(int status, JSONObject body) {
        return new Sync.Response(status, body.toString());
    }
}
