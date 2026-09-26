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
    /** Réglages du compte, {@code {nonce, blob}} ; null tant qu'aucun n'est poussé. */
    JSONObject settings = null;
    int settingsPuts = 0;

    /** Plafond rendu au pull ; null pour un serveur qui ne le dit pas. */
    Integer maxEntries = null;

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
            if (url.endsWith("/v1/auth/login") || url.endsWith("/v1/auth/register")
                    || url.endsWith("/v1/auth/google")) {
                return json(200, new JSONObject()
                        .put("access_token", validAccessToken)
                        .put("refresh_token", "refresh-0"));
            }

            if (!validAccessToken.equals(bearer)) {
                return json(401, new JSONObject().put("detail", "Jeton expiré"));
            }
            if (url.endsWith("/v1/settings")) {
                return "GET".equals(method) ? pullSettings() : putSettings(new JSONObject(body));
            }
            return "GET".equals(method) ? pull() : push(new JSONObject(body));
        } catch (JSONException e) {
            throw new AssertionError(e);
        }
    }

    /** Dépose une ligne telle qu'un autre client l'aurait poussée. */
    void seed(JSONObject row) throws JSONException {
        rows.put(row.getString("entry_id"), row);
        revision++;
    }

    private Sync.Response pull() throws JSONException {
        JSONArray entries = new JSONArray();
        for (JSONObject row : rows.values()) entries.put(row);
        JSONObject body = new JSONObject().put("revision", revision).put("entries", entries);
        if (maxEntries != null) body.put("max_entries", maxEntries);
        return json(200, body);
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

    private Sync.Response pullSettings() {
        // 204 : le compte n'a pas encore de réglages.
        return settings == null ? new Sync.Response(204, "") : json(200, settings);
    }

    private Sync.Response putSettings(JSONObject payload) throws JSONException {
        // Le serveur ne lit rien : il garde le blob tel quel.
        settings = new JSONObject()
                .put("nonce", payload.getString("nonce"))
                .put("blob", payload.getString("blob"));
        settingsPuts++;
        return new Sync.Response(204, "");
    }

    private static Sync.Response json(int status, JSONObject body) {
        return new Sync.Response(status, body.toString());
    }
}
