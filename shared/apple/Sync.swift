//
//  Sync.swift
//  Client de synchronisation.
//
//  Le carnet est chiffré *avant* de quitter l'appareil, avec la clef de
//  transfert dérivée de la clef maîtresse. Le serveur ne reçoit que des blocs
//  opaques : il ne peut ni lire les sites, ni les identifiants, ni rien déduire
//  au-delà du nombre d'entrées.
//
//  Les identifiants du compte de synchronisation sont volontairement distincts
//  de la clef maîtresse. S'authentifier avec celle-ci ferait qu'une faiblesse
//  du service exposerait les mots de passe eux-mêmes.
//
//  Miroir de apps/cli/thecode/sync.py et apps/android/.../vault/Sync.java.
//
//  Source unique : shared/apple/Sync.swift
//

import CryptoKit
import Foundation

/// Échec de synchronisation : réseau, authentification, ou conflit.
public struct SyncError: Error, Equatable {
    /// Code HTTP, ou 0 quand l'échec est antérieur à la réponse.
    public let status: Int
    public let message: String

    public init(status: Int = 0, message: String) {
        self.status = status
        self.message = message
    }
}

/// Jetons de session. Stockés à part du carnet, et jamais dans le carnet.
public struct SyncCredentials: Codable, Equatable {
    public let endpoint: String
    public let accessToken: String
    public let refreshToken: String
    /// Offre du compte, telle que le service l'a dite la dernière fois.
    ///
    /// Gardée avec les jetons parce que la génération se fait hors ligne :
    /// sans cette trace, l'écran ne saurait pas quoi proposer tant que le
    /// service n'a pas répondu, et proposerait donc tout.
    public let plan: String

    public init(
        endpoint: String, accessToken: String, refreshToken: String,
        plan: String = SyncPlan.free
    ) {
        self.endpoint = endpoint
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.plan = plan
    }

    /// Les mêmes jetons, avec une offre relue.
    public func withPlan(_ plan: String) -> SyncCredentials {
        SyncCredentials(
            endpoint: endpoint, accessToken: accessToken, refreshToken: refreshToken, plan: plan)
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        endpoint = try container.decode(String.self, forKey: .endpoint)
        accessToken = try container.decode(String.self, forKey: .accessToken)
        refreshToken = try container.decode(String.self, forKey: .refreshToken)
        // Absent des trousseaux écrits avant l'arrivée des offres : décoder
        // strictement ferait perdre la session de tout le monde à la mise à
        // jour, ce qui coûterait bien plus qu'une relecture de l'offre.
        plan = try container.decodeIfPresent(String.self, forKey: .plan) ?? SyncPlan.free
    }

    private enum CodingKeys: String, CodingKey {
        case endpoint
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case plan
    }
}

/// Les offres, et ce qu'elles ouvrent.
public enum SyncPlan {
    public static let free = "free"
    public static let pro = "pro"

    /// Vrai quand l'offre donne droit au compteur.
    public static func isPaid(_ plan: String?) -> Bool { plan == pro }
}

/// Une réponse HTTP brute, corps compris même en cas d'erreur.
public struct SyncResponse: Equatable {
    public let status: Int
    public let body: Data

    public init(status: Int, body: Data) {
        self.status = status
        self.body = body
    }
}

/// Le transport, isolé pour que les tests n'aient pas besoin d'un serveur.
public protocol SyncTransport {
    func send(url: String, method: String, body: Data?, bearer: String?) async throws -> SyncResponse
}

public struct Sync {

    public static let defaultEndpoint = "https://thecode-api.julsql.fr"

    /// Ce que la synchronisation rend : le carnet fusionné et ses désaccords.
    public struct Result {
        public let vault: Vault
        public let conflicts: [VaultConflict]
        /// Éventuellement renouvelés : l'appelant doit les réenregistrer.
        public let credentials: SyncCredentials
    }

    private let transport: SyncTransport

    public init(transport: SyncTransport = URLSessionTransport()) {
        self.transport = transport
    }

    // MARK: - Appels

    private func call(
        _ url: String, method: String, payload: [String: Any]? = nil, bearer: String? = nil
    ) async throws -> [String: Any] {
        let body = try payload.map {
            try JSONSerialization.data(withJSONObject: $0, options: [.sortedKeys])
        }

        let response: SyncResponse
        do {
            response = try await transport.send(
                url: url, method: method, body: body, bearer: bearer)
        } catch let error as SyncError {
            throw error
        } catch {
            throw SyncError(message: "Service injoignable : \(error.localizedDescription)")
        }

        let parsed =
            (try? JSONSerialization.jsonObject(with: response.body)) as? [String: Any] ?? [:]

        guard response.status < 400 else {
            // Le corps porte souvent un message utile ; s'il est illisible on
            // se rabat sur le code HTTP plutôt que de masquer l'erreur.
            let detail = parsed["detail"] as? String ?? ""
            throw SyncError(
                status: response.status,
                message: "\(response.status) : \(detail.isEmpty ? "échec" : detail)")
        }
        return parsed
    }

    private func credentials(from body: [String: Any], endpoint: String) throws -> SyncCredentials {
        guard let access = body["access_token"] as? String,
            let refresh = body["refresh_token"] as? String
        else {
            throw SyncError(message: "Réponse inattendue du service d'authentification")
        }
        return SyncCredentials(endpoint: endpoint, accessToken: access, refreshToken: refresh)
    }

    public func register(
        endpoint: String, email: String, password: String, inviteCode: String = ""
    ) async throws -> SyncCredentials {
        let body = try await call(
            "\(endpoint)/v1/auth/register", method: "POST",
            payload: ["email": email, "password": password, "invite_code": inviteCode])
        return try credentials(from: body, endpoint: endpoint)
    }

    public func login(
        endpoint: String, email: String, password: String, deviceLabel: String = ""
    ) async throws -> SyncCredentials {
        let body = try await call(
            "\(endpoint)/v1/auth/login", method: "POST",
            payload: ["email": email, "password": password, "device_label": deviceLabel])
        return try credentials(from: body, endpoint: endpoint)
    }

    /// Relit l'offre du compte, en renouvelant le jeton s'il a expiré.
    ///
    /// Rend les identifiants mis à jour : l'appelant doit les réenregistrer,
    /// sans quoi l'offre relue serait oubliée au prochain démarrage.
    public func accountPlan(credentials creds: SyncCredentials) async throws -> SyncCredentials {
        var current = creds
        var body: [String: Any]
        do {
            body = try await call(
                "\(creds.endpoint)/v1/auth/me", method: "GET", bearer: creds.accessToken)
        } catch let error as SyncError where error.status == 401 {
            current = try await refresh(creds)
            body = try await call(
                "\(current.endpoint)/v1/auth/me", method: "GET", bearer: current.accessToken)
        }
        return current.withPlan(body["plan"] as? String ?? SyncPlan.free)
    }

    private func refresh(_ creds: SyncCredentials) async throws -> SyncCredentials {
        let body = try await call(
            "\(creds.endpoint)/v1/auth/refresh", method: "POST",
            payload: ["refresh_token": creds.refreshToken])
        return try credentials(from: body, endpoint: creds.endpoint)
    }

    // MARK: - Synchronisation

    /// Synchronise le carnet local avec le serveur.
    ///
    /// Toujours dans cet ordre : on tire d'abord, on fusionne, puis on pousse.
    /// Pousser sans avoir tiré écraserait ce qu'un autre appareil a écrit entre
    /// temps — et le serveur le refuse, précisément pour cette raison.
    public func sync(
        _ local: Vault, masterKey: String, credentials creds: SyncCredentials
    ) async throws -> Result {
        let key = try Transfer.deriveKey(masterKey)
        let url = "\(creds.endpoint)/v1/vault"

        let pulled = try await call(url, method: "GET", bearer: creds.accessToken)
        let remote = try decodeRemote(pulled, fallbackUpdatedAt: local.updatedAt, key: key)

        let (merged, conflicts) = Vault.merge(local, remote)

        let payload = try encodePush(
            baseRevision: pulled["revision"] as? Int ?? 0, merged: merged, key: key)
        _ = try await call(url, method: "POST", payload: payload, bearer: creds.accessToken)

        return Result(vault: merged, conflicts: conflicts, credentials: creds)
    }

    /// Comme `sync`, en renouvelant le jeton d'accès s'il a expiré.
    ///
    /// Le jeton d'accès dure quinze minutes : sur un usage normal il expire
    /// entre deux synchronisations. Redemander le mot de passe à chaque fois
    /// serait intenable. On rejoue la synchronisation entière plutôt que le
    /// seul appel fautif, pour ne jamais pousser sur une révision périmée.
    public func syncRenewing(
        _ local: Vault, masterKey: String, credentials creds: SyncCredentials
    ) async throws -> Result {
        do {
            return try await sync(local, masterKey: masterKey, credentials: creds)
        } catch let error as SyncError where error.status == 401 {
            let renewed = try await refresh(creds)
            let result = try await sync(local, masterKey: masterKey, credentials: renewed)
            return Result(
                vault: result.vault, conflicts: result.conflicts, credentials: renewed)
        }
    }

    private func decodeRemote(
        _ pulled: [String: Any], fallbackUpdatedAt: String?, key: SymmetricKey
    ) throws -> Vault {
        var remote = Vault()
        remote.updatedAt = fallbackUpdatedAt

        for case let row as [String: Any] in pulled["entries"] as? [Any] ?? [] {
            guard let nonce = (row["nonce"] as? String).flatMap(Base64URL.decode),
                let blob = (row["blob"] as? String).flatMap(Base64URL.decode)
            else {
                throw SyncError(message: "Carnet distant illisible : encodage invalide")
            }

            let plain: Data
            do {
                plain = try Transfer.open(nonce: nonce, blob: blob, with: key)
            } catch {
                throw SyncError(
                    message: "Déchiffrement impossible : la clef maîtresse n'est pas celle "
                        + "qui a servi à synchroniser ce carnet.")
            }

            guard var entry = try? JSONDecoder().decode(VaultEntry.self, from: plain) else {
                throw SyncError(message: "Carnet distant illisible : entrée invalide")
            }
            // La pierre tombale du serveur fait foi même si l'entrée chiffrée
            // est antérieure à la suppression.
            if row["deleted"] as? Bool == true { entry.deleted = true }
            remote.entries.append(entry)
        }
        return remote
    }

    private func encodePush(
        baseRevision: Int, merged: Vault, key: SymmetricKey
    ) throws -> [String: Any] {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]

        var rows: [[String: Any]] = []
        for entry in merged.entries {
            let sealed = try Transfer.seal(try encoder.encode(entry), with: key)
            rows.append([
                "entry_id": entry.id,
                "nonce": Base64URL.encode(sealed.nonce),
                "blob": Base64URL.encode(sealed.blob),
                "deleted": entry.deleted ?? false,
            ])
        }
        return ["base_revision": baseRevision, "entries": rows]
    }
}

/// Base64 « url-safe », sans remplissage : ce que l'API attend et ce que les
/// quatre autres implémentations produisent.
enum Base64URL {
    static func encode(_ raw: Data) -> String {
        raw.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func decode(_ value: String) -> Data? {
        var standard =
            value
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        standard += String(repeating: "=", count: (4 - standard.count % 4) % 4)
        return Data(base64Encoded: standard)
    }
}

/// Transport réel.
public struct URLSessionTransport: SyncTransport {

    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func send(
        url: String, method: String, body: Data?, bearer: String?
    ) async throws -> SyncResponse {
        guard let target = URL(string: url) else {
            throw SyncError(message: "Adresse de service invalide : \(url)")
        }

        var request = URLRequest(url: target)
        request.httpMethod = method
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let bearer { request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization") }
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        return SyncResponse(status: status, body: data)
    }
}
