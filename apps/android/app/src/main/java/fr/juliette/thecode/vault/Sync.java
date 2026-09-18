package fr.juliette.thecode.vault;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.List;

import javax.crypto.SecretKey;

/**
 * Client de synchronisation.
 *
 * Le carnet est chiffré <b>avant</b> de quitter l'appareil, avec la clef de
 * transfert dérivée de la clef maîtresse. Le serveur ne reçoit que des blocs
 * opaques : il ne peut ni lire les sites, ni les identifiants, ni rien déduire
 * au-delà du nombre d'entrées.
 *
 * Les identifiants du compte de synchronisation sont volontairement distincts
 * de la clef maîtresse. S'authentifier avec celle-ci ferait qu'une faiblesse du
 * service exposerait les mots de passe eux-mêmes.
 *
 * Miroir de {@code apps/cli/thecode/sync.py} et {@code apps/extension/sync.js}.
 */
public final class Sync {

    public static final String DEFAULT_ENDPOINT = "https://thecode.julsql.fr/api";

    private static final int TIMEOUT_MS = 30_000;

    /** Échec de synchronisation : réseau, authentification, ou conflit. */
    public static class SyncException extends Exception {
        public final int status;

        public SyncException(String message) {
            this(0, message);
        }

        public SyncException(int status, String message) {
            super(message);
            this.status = status;
        }
    }

    /** Jetons de session. Stockés à part du carnet, et jamais dans le carnet. */
    public static final class Credentials {
        public final String endpoint;
        public final String accessToken;
        public final String refreshToken;

        public Credentials(@NonNull String endpoint, @NonNull String accessToken,
                           @NonNull String refreshToken) {
            this.endpoint = endpoint;
            this.accessToken = accessToken;
            this.refreshToken = refreshToken;
        }

        static Credentials from(String endpoint, JSONObject body) throws JSONException {
            return new Credentials(endpoint,
                    body.getString("access_token"), body.getString("refresh_token"));
        }
    }

    /** Ce que la synchronisation rend : le carnet fusionné et ses désaccords. */
    public static final class Result {
        public final Vault vault;
        public final List<Vault.Conflict> conflicts;
        /** Éventuellement renouvelés : l'appelant doit les réenregistrer. */
        public final Credentials credentials;

        Result(Vault vault, List<Vault.Conflict> conflicts, Credentials credentials) {
            this.vault = vault;
            this.conflicts = conflicts;
            this.credentials = credentials;
        }
    }

    /** Une réponse HTTP brute, corps compris même en cas d'erreur. */
    public static final class Response {
        public final int status;
        public final String body;

        public Response(int status, @Nullable String body) {
            this.status = status;
            this.body = body == null ? "" : body;
        }
    }

    /**
     * Le transport, isolé pour que les tests n'aient pas besoin d'un serveur.
     */
    public interface Http {
        Response send(String url, String method, @Nullable String body, @Nullable String bearer)
                throws IOException;
    }

    private final Http http;

    public Sync() {
        this(new UrlConnectionHttp());
    }

    public Sync(@NonNull Http http) {
        this.http = http;
    }

    // ---------------------------------------------------------------- appels

    private JSONObject call(String url, String method, @Nullable JSONObject payload,
                            @Nullable String bearer) throws SyncException {
        Response response;
        try {
            response = http.send(url, method, payload == null ? null : payload.toString(), bearer);
        } catch (IOException e) {
            throw new SyncException("Service injoignable : " + e.getMessage());
        }

        if (response.status >= 400) {
            // Le corps porte souvent un message utile ; s'il est illisible on
            // se rabat sur le code HTTP plutôt que de masquer l'erreur.
            String detail = "";
            try {
                detail = new JSONObject(response.body).optString("detail", "");
            } catch (JSONException ignored) {
                // Corps non JSON : le code suffira.
            }
            throw new SyncException(response.status,
                    response.status + " : " + (detail.isEmpty() ? "échec" : detail));
        }

        if (response.body.isEmpty()) return new JSONObject();
        try {
            return new JSONObject(response.body);
        } catch (JSONException e) {
            throw new SyncException("Réponse illisible du service");
        }
    }

    public Credentials register(@NonNull String endpoint, @NonNull String email,
                                @NonNull String password, @NonNull String inviteCode)
            throws SyncException {
        try {
            JSONObject payload = new JSONObject()
                    .put("email", email)
                    .put("password", password)
                    .put("invite_code", inviteCode);
            return Credentials.from(endpoint,
                    call(endpoint + "/v1/auth/register", "POST", payload, null));
        } catch (JSONException e) {
            throw new SyncException("Réponse inattendue à l'inscription");
        }
    }

    public Credentials login(@NonNull String endpoint, @NonNull String email,
                             @NonNull String password, @NonNull String deviceLabel)
            throws SyncException {
        try {
            JSONObject payload = new JSONObject()
                    .put("email", email)
                    .put("password", password)
                    .put("device_label", deviceLabel);
            return Credentials.from(endpoint,
                    call(endpoint + "/v1/auth/login", "POST", payload, null));
        } catch (JSONException e) {
            throw new SyncException("Réponse inattendue à la connexion");
        }
    }

    private Credentials refresh(Credentials creds) throws SyncException {
        try {
            JSONObject payload = new JSONObject().put("refresh_token", creds.refreshToken);
            return Credentials.from(creds.endpoint,
                    call(creds.endpoint + "/v1/auth/refresh", "POST", payload, null));
        } catch (JSONException e) {
            throw new SyncException("Réponse inattendue au renouvellement");
        }
    }

    // ------------------------------------------------------- synchronisation

    /**
     * Synchronise le carnet local avec le serveur.
     *
     * Toujours dans cet ordre : on tire d'abord, on fusionne, puis on pousse.
     * Pousser sans avoir tiré écraserait ce qu'un autre appareil a écrit entre
     * temps — et le serveur le refuse, précisément pour cette raison.
     */
    public Result sync(@NonNull Vault local, @NonNull String masterKey,
                       @NonNull Credentials creds) throws SyncException {
        SecretKey key;
        try {
            key = Transfer.deriveKey(masterKey);
        } catch (GeneralSecurityException e) {
            throw new SyncException("Clef de transfert indérivable : " + e.getMessage());
        }

        String url = creds.endpoint + "/v1/vault";

        JSONObject pulled = call(url, "GET", null, creds.accessToken);
        Vault remote = decodeRemote(pulled, local.updatedAt, key);

        List<Vault.Conflict> conflicts = new ArrayList<>();
        Vault merged = Vault.merge(local, remote, conflicts);

        JSONObject payload = encodePush(pulled.optInt("revision", 0), merged, key);
        call(url, "POST", payload, creds.accessToken);

        return new Result(merged, conflicts, creds);
    }

    /**
     * Comme {@link #sync}, en renouvelant le jeton d'accès s'il a expiré.
     *
     * Le jeton d'accès dure quinze minutes : sur un usage normal il expire
     * entre deux synchronisations. Redemander le mot de passe à chaque fois
     * serait intenable. On rejoue la synchronisation entière plutôt que le
     * seul appel fautif, pour ne jamais pousser sur une révision périmée.
     */
    public Result syncRenewing(@NonNull Vault local, @NonNull String masterKey,
                               @NonNull Credentials creds) throws SyncException {
        try {
            return sync(local, masterKey, creds);
        } catch (SyncException e) {
            if (e.status != 401) throw e;
            Credentials renewed = refresh(creds);
            Result result = sync(local, masterKey, renewed);
            return new Result(result.vault, result.conflicts, renewed);
        }
    }

    private Vault decodeRemote(JSONObject pulled, String fallbackUpdatedAt, SecretKey key)
            throws SyncException {
        Vault remote = new Vault();
        remote.updatedAt = fallbackUpdatedAt;
        try {
            JSONArray rows = pulled.getJSONArray("entries");
            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.getJSONObject(i);
                byte[] plain = Transfer.openBytes(key,
                        Base64Url.decode(row.getString("nonce")),
                        Base64Url.decode(row.getString("blob")));
                VaultEntry entry = VaultEntry.fromJson(
                        new JSONObject(new String(plain, StandardCharsets.UTF_8)));
                // La pierre tombale du serveur fait foi même si l'entrée
                // chiffrée est antérieure à la suppression.
                entry.deleted = entry.deleted || row.optBoolean("deleted", false);
                remote.entries.add(entry);
            }
        } catch (GeneralSecurityException e) {
            throw new SyncException("Déchiffrement impossible : la clef maîtresse n'est pas "
                    + "celle qui a servi à synchroniser ce carnet.");
        } catch (JSONException | IllegalArgumentException e) {
            throw new SyncException("Carnet distant illisible : " + e.getMessage());
        }
        return remote;
    }

    private JSONObject encodePush(int baseRevision, Vault merged, SecretKey key)
            throws SyncException {
        try {
            JSONArray rows = new JSONArray();
            for (VaultEntry entry : merged.entries) {
                Transfer.Sealed sealed = Transfer.seal(key, entry.toJson().toString());
                rows.put(new JSONObject()
                        .put("entry_id", entry.id)
                        .put("nonce", Base64Url.encode(sealed.nonce))
                        .put("blob", Base64Url.encode(sealed.blob))
                        .put("deleted", entry.deleted));
            }
            return new JSONObject().put("base_revision", baseRevision).put("entries", rows);
        } catch (GeneralSecurityException | JSONException e) {
            throw new SyncException("Chiffrement du carnet impossible : " + e.getMessage());
        }
    }

    // ------------------------------------------------------------ transport

    /** Transport réel. HttpURLConnection plutôt qu'une dépendance de plus. */
    static final class UrlConnectionHttp implements Http {
        @Override
        public Response send(String url, String method, @Nullable String body,
                             @Nullable String bearer) throws IOException {
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            try {
                connection.setRequestMethod(method);
                connection.setConnectTimeout(TIMEOUT_MS);
                connection.setReadTimeout(TIMEOUT_MS);
                connection.setRequestProperty("Accept", "application/json");
                if (bearer != null) {
                    connection.setRequestProperty("Authorization", "Bearer " + bearer);
                }
                if (body != null) {
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/json");
                    try (OutputStream out = connection.getOutputStream()) {
                        out.write(body.getBytes(StandardCharsets.UTF_8));
                    }
                }

                int status = connection.getResponseCode();
                // getErrorStream pour les codes >= 400 : getInputStream y lève,
                // et on perdrait le message que l'API prend soin de rendre.
                InputStream stream = status >= 400
                        ? connection.getErrorStream() : connection.getInputStream();
                return new Response(status, stream == null ? "" : readAll(stream));
            } finally {
                connection.disconnect();
            }
        }

        private static String readAll(InputStream stream) throws IOException {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int read;
            while ((read = stream.read(chunk)) != -1) buffer.write(chunk, 0, read);
            return new String(buffer.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
