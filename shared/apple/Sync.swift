//
//  Sync.swift
//  Client de synchronisation.
//
//  Le carnet est chiffré *avant* de quitter l'appareil, avec une clef dérivée
//  de la clef maîtresse et du sel propre au compte (`kdf_salt`), chaque bloc
//  lié à sa ligne par des données associées (shared/spec/vault-sync.md).
//  Le serveur ne reçoit que des blocs
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
    /// Sel de dérivation du compte (16 octets, base64url), rendu par le
    /// service à la connexion et par /v1/auth/me. Public : il rend seulement
    /// la clef de synchronisation propre au compte. Vide tant qu'inconnu.
    public let kdfSalt: String

    public init(
        endpoint: String, accessToken: String, refreshToken: String,
        plan: String = SyncPlan.free, kdfSalt: String = ""
    ) {
        self.endpoint = endpoint
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.plan = plan
        self.kdfSalt = kdfSalt
    }

    /// Les mêmes jetons, avec une offre relue.
    public func withPlan(_ plan: String) -> SyncCredentials {
        SyncCredentials(
            endpoint: endpoint, accessToken: accessToken, refreshToken: refreshToken, plan: plan,
            kdfSalt: kdfSalt)
    }

    /// Les mêmes jetons, avec le sel du compte. Une valeur vide garde l'actuel :
    /// un service muet ne doit pas faire oublier un sel connu.
    public func withKdfSalt(_ salt: String?) -> SyncCredentials {
        guard let salt, !salt.isEmpty else { return self }
        return SyncCredentials(
            endpoint: endpoint, accessToken: accessToken, refreshToken: refreshToken, plan: plan,
            kdfSalt: salt)
    }

    /// Le sel décodé, ou `nil` s'il manque ou ne fait pas 16 octets.
    public var decodedKdfSalt: Data? {
        guard let raw = Base64URL.decode(kdfSalt), raw.count == Sync.kdfSaltBytes else {
            return nil
        }
        return raw
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
        // Absent des trousseaux antérieurs au format v2 : relu sur /v1/auth/me
        // à la prochaine synchronisation.
        kdfSalt = try container.decodeIfPresent(String.self, forKey: .kdfSalt) ?? ""
    }

    private enum CodingKeys: String, CodingKey {
        case endpoint
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case plan
        case kdfSalt = "kdf_salt"
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
        /// Entrées restées sur l'appareil, faute de place sous le plafond.
        public let localOnly: Int
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
            throw SyncError(
                message: L10nSync.t(
                    "Service injoignable : \(error.localizedDescription)",
                    "Service unreachable: \(error.localizedDescription)"))
        }

        let parsed =
            (try? JSONSerialization.jsonObject(with: response.body)) as? [String: Any] ?? [:]

        guard response.status < 400 else {
            // Le corps porte souvent un message utile ; s'il est illisible on
            // se rabat sur le code HTTP plutôt que de masquer l'erreur.
            let detail = parsed["detail"] as? String ?? ""
            throw SyncError(
                status: response.status,
                message: L10nSync.t(
                    "\(response.status) : \(detail.isEmpty ? "échec" : detail)",
                    "\(response.status): \(detail.isEmpty ? "failed" : detail)"))
        }
        return parsed
    }

    private func credentials(from body: [String: Any], endpoint: String) throws -> SyncCredentials {
        guard let access = body["access_token"] as? String,
            let refresh = body["refresh_token"] as? String
        else {
            throw SyncError(
                message: L10nSync.t(
                    "Réponse inattendue du service d'authentification",
                    "Unexpected response from the authentication service"))
        }
        return SyncCredentials(
            endpoint: endpoint, accessToken: access, refreshToken: refresh,
            kdfSalt: body["kdf_salt"] as? String ?? "")
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

    /// Connexion (ou création du compte) à partir d'un jeton d'identité Google.
    /// Mêmes jetons en retour que `login`, à enregistrer de la même façon.
    public func googleSignIn(
        endpoint: String, idToken: String, lang: String, deviceLabel: String = "",
        inviteCode: String = ""
    ) async throws -> SyncCredentials {
        let body = try await call(
            "\(endpoint)/v1/auth/google", method: "POST",
            payload: GoogleAuth.apiBody(
                idToken: idToken, lang: lang, deviceLabel: deviceLabel, inviteCode: inviteCode))
        return try credentials(from: body, endpoint: endpoint)
    }

    /// Connexion (ou création du compte) à partir d'un jeton d'identité Apple
    /// et du nonce *brut* dont l'empreinte a été confiée à Apple. Le code
    /// d'autorisation, facultatif, sert à l'API à révoquer les jetons Apple
    /// quand le compte est supprimé.
    public func appleSignIn(
        endpoint: String, identityToken: String, rawNonce: String, lang: String,
        deviceLabel: String = "", authorizationCode: String = ""
    ) async throws -> SyncCredentials {
        let body = try await call(
            "\(endpoint)/v1/auth/apple", method: "POST",
            payload: AppleAuth.apiBody(
                identityToken: identityToken, rawNonce: rawNonce, lang: lang,
                deviceLabel: deviceLabel, authorizationCode: authorizationCode))
        return try credentials(from: body, endpoint: endpoint)
    }

    /// Vrai si le service accepte « Se connecter avec Apple ». Toute erreur
    /// (réseau, ancien serveur) vaut non : le bouton reste caché.
    public func appleEnabled(endpoint: String) async -> Bool {
        guard let body = try? await call("\(endpoint)/v1/auth/registration", method: "GET")
        else { return false }
        return AppleAuth.isEnabled(registration: body)
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
            .withKdfSalt(body["kdf_salt"] as? String)
    }

    /// Révoque la session côté service : l'appareil cesse de compter parmi
    /// les appareils connectés.
    ///
    /// Au mieux : toute erreur est ignorée et le jeton n'est pas renouvelé.
    /// La déconnexion locale ne doit jamais en dépendre, hors ligne compris.
    public func logout(credentials creds: SyncCredentials) async {
        _ = try? await call(
            "\(creds.endpoint)/v1/auth/logout", method: "POST",
            payload: ["refresh_token": creds.refreshToken])
    }

    // MARK: - Suppression du compte

    /// Ce que la suppression du compte doit savoir de lui, lu à GET /v1/auth/me.
    public struct AccountIdentity: Equatable {
        /// L'adresse à recopier : le service l'exige pour supprimer.
        public let email: String
        /// Faux pour un compte créé par Google ou Apple sans mot de passe.
        public let hasPassword: Bool
        /// Éventuellement renouvelés, offre relue : à réenregistrer.
        public let credentials: SyncCredentials
    }

    /// Relit le compte, en renouvelant le jeton s'il a expiré.
    public func accountIdentity(credentials creds: SyncCredentials) async throws -> AccountIdentity
    {
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
        // Absent d'un ancien service : le mot de passe est alors demandé, et le
        // service l'ignore pour un compte qui n'en a pas.
        return AccountIdentity(
            email: body["email"] as? String ?? "",
            hasPassword: body["has_password"] as? Bool ?? true,
            credentials: current.withPlan(body["plan"] as? String ?? SyncPlan.free)
                .withKdfSalt(body["kdf_salt"] as? String))
    }

    /// Supprime le compte sur le service : le compte, le carnet chiffré, les
    /// réglages et les sessions de tous les appareils.
    ///
    /// Deux preuves, comme l'exige l'API : l'adresse recopiée et, si le compte
    /// en a un, son mot de passe. Le jeton est renouvelé s'il a expiré.
    public func deleteAccount(
        credentials creds: SyncCredentials, confirmEmail: String, password: String
    ) async throws {
        let payload: [String: Any] = [
            "confirm_email": confirmEmail.trimmingCharacters(in: .whitespacesAndNewlines),
            "password": password,
        ]
        let url = "\(creds.endpoint)/v1/account"
        do {
            _ = try await call(url, method: "DELETE", payload: payload, bearer: creds.accessToken)
        } catch let error as SyncError where error.status == 401 {
            let renewed = try await refresh(creds)
            _ = try await call(
                url, method: "DELETE", payload: payload, bearer: renewed.accessToken)
        }
    }

    /// Vrai quand l'adresse recopiée est celle du compte, casse et blancs ignorés.
    public static func emailMatches(_ typed: String, _ accountEmail: String) -> Bool {
        let account = accountEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !account.isEmpty else { return false }
        return typed.trimmingCharacters(in: .whitespacesAndNewlines)
            .caseInsensitiveCompare(account) == .orderedSame
    }

    private func refresh(_ creds: SyncCredentials) async throws -> SyncCredentials {
        let body = try await call(
            "\(creds.endpoint)/v1/auth/refresh", method: "POST",
            payload: ["refresh_token": creds.refreshToken])
        // Le sel ne change jamais : gardé si la réponse ne le redit pas.
        let renewed = try credentials(from: body, endpoint: creds.endpoint)
        return renewed.kdfSalt.isEmpty ? renewed.withKdfSalt(creds.kdfSalt) : renewed
    }

    // MARK: - Chiffrement v2

    public static let kdfSaltBytes = 16
    private static let syncLabel = "thecode-sync/v2"
    private static let entryAADPrefix = "thecode/entry/v2|"
    /// Données associées des réglages : le serveur ne peut pas les faire
    /// passer pour une entrée, ni l'inverse.
    public static let settingsAAD = Data("thecode/settings/v2".utf8)

    /// Clef de synchronisation : propre à la clef maîtresse **et** au compte.
    ///
    /// Le sel du compte empêche de précalculer une table valable pour tous les
    /// comptes : qui vole la base doit s'attaquer à chacun séparément.
    public static func deriveKey(masterKey: String, kdfSalt: Data) throws -> SymmetricKey {
        try Transfer.pbkdf2(masterKey, salt: Data(syncLabel.utf8) + kdfSalt)
    }

    /// Données associées d'une entrée : lient le blob à son identifiant en clair.
    ///
    /// Sans elles, le serveur pourrait échanger les blobs de deux entrées, ou
    /// rejouer un vieux blob sous un autre identifiant.
    public static func entryAAD(_ entryId: String) -> Data {
        Data((entryAADPrefix + entryId).utf8)
    }

    public enum EntryError: Error, Equatable {
        /// Tag invalide : autre clef maîtresse, autre compte, blob déplacé ou altéré.
        case cannotOpen
        /// Déchiffrée, mais pas une entrée lisible.
        case unreadable
        /// L'entrée déchiffrée ne porte pas l'identifiant de sa ligne.
        case idMismatch
    }

    /// Chiffre une entrée pour sa ligne.
    public static func sealEntry(_ entry: VaultEntry, key: SymmetricKey) throws -> Transfer.Sealed {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try Transfer.seal(encoder.encode(entry), with: key, aad: entryAAD(entry.id))
    }

    /// Déchiffre une ligne, et la rejette si l'entrée ne dit pas le même
    /// identifiant qu'elle : elle ne doit jamais être fusionnée sous un autre.
    public static func openEntry(
        entryId: String, nonce: Data, blob: Data, key: SymmetricKey
    ) throws -> VaultEntry {
        let plain: Data
        do {
            plain = try Transfer.open(nonce: nonce, blob: blob, with: key, aad: entryAAD(entryId))
        } catch {
            throw EntryError.cannotOpen
        }
        guard let entry = try? JSONDecoder().decode(VaultEntry.self, from: plain) else {
            throw EntryError.unreadable
        }
        guard entry.id == entryId else { throw EntryError.idMismatch }
        return entry
    }

    /// Chiffre les réglages par défaut du compte.
    public static func sealSettings(_ settings: SharedSettings, key: SymmetricKey) throws
        -> Transfer.Sealed
    {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try Transfer.seal(encoder.encode(settings), with: key, aad: settingsAAD)
    }

    /// Déchiffre et valide un blob de réglages ; `nil` s'il est inutilisable.
    public static func openSettings(nonce: Data, blob: Data, key: SymmetricKey)
        -> SharedSettings?
    {
        guard let plain = try? Transfer.open(nonce: nonce, blob: blob, with: key, aad: settingsAAD),
            let settings = try? JSONDecoder().decode(SharedSettings.self, from: plain)
        else { return nil }
        return settings.validated()
    }

    /// Le sel du compte, relu sur /v1/auth/me s'il manque.
    ///
    /// Sans sel valide, rien ne part : chiffrer avec un autre sel rendrait les
    /// blocs illisibles pour les autres appareils du compte.
    private func accountSalt(_ creds: SyncCredentials) async throws -> (Data, SyncCredentials) {
        if let salt = creds.decodedKdfSalt { return (salt, creds) }
        let updated = try await accountPlan(credentials: creds)
        guard let salt = updated.decodedKdfSalt else {
            throw SyncError(
                message: L10nSync.t(
                    "Le service n'a pas rendu le sel de dérivation du compte : reconnectez-vous.",
                    "The service did not return the account's key derivation salt: sign in again."
                ))
        }
        return (salt, updated)
    }

    // MARK: - Synchronisation

    /// Synchronise le carnet local avec le serveur.
    ///
    /// Toujours dans cet ordre : on tire d'abord, on fusionne, puis on pousse.
    /// Pousser sans avoir tiré écraserait ce qu'un autre appareil a écrit entre
    /// temps — et le serveur le refuse, précisément pour cette raison.
    public func sync(
        _ local: Vault, masterKey: String, credentials: SyncCredentials
    ) async throws -> Result {
        // Une seule dérivation par synchronisation : sk sert à tout le carnet.
        let (salt, creds) = try await accountSalt(credentials)
        let key = try Self.deriveKey(masterKey: masterKey, kdfSalt: salt)
        let url = "\(creds.endpoint)/v1/vault"

        let pulled = try await call(url, method: "GET", bearer: creds.accessToken)
        let remote = try decodeRemote(pulled, fallbackUpdatedAt: local.updatedAt, key: key)

        let (merged, conflicts) = Vault.merge(local, remote)

        // Au-delà du plafond, le reste du carnet ne part pas : il reste propre
        // à l'appareil. Un serveur qui ne dit pas son plafond reçoit tout.
        let push: [VaultEntry]
        let localOnly: [VaultEntry]
        if let maxEntries = pulled["max_entries"] as? Int {
            let remoteIds = (pulled["entries"] as? [[String: Any]] ?? [])
                .compactMap { $0["entry_id"] as? String }
            (push, localOnly) = Vault.selectForPush(
                merged, remoteIds: remoteIds, maxEntries: maxEntries)
        } else {
            (push, localOnly) = (merged.entries, [])
        }

        let payload = try encodePush(
            baseRevision: pulled["revision"] as? Int ?? 0, entries: push, key: key)
        _ = try await call(url, method: "POST", payload: payload, bearer: creds.accessToken)

        return Result(
            vault: merged, conflicts: conflicts, localOnly: localOnly.count, credentials: creds)
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
            return try await sync(local, masterKey: masterKey, credentials: renewed)
        }
    }

    // MARK: - Réglages par défaut

    /// Ce que la synchronisation des réglages a décidé.
    public enum SettingsOutcome: Equatable {
        /// La valeur distante est plus récente (ou à égalité) : à appliquer.
        case applyRemote(SharedSettings)
        /// La locale était plus récente, ou le compte n'en avait pas : poussée.
        case pushedLocal
        /// Blob distant indéchiffrable ou invalide : rien n'est touché, ni
        /// localement ni sur le serveur.
        case ignoredRemote
        /// Réglages locaux jamais modifiés, compte vide : rien n'est poussé.
        case keptLocal
    }

    /// Synchronise les réglages par défaut. Voir shared/spec/default-settings.md.
    ///
    /// À appeler après la synchronisation du carnet. Tirer, garder le plus
    /// récent (à égalité, le distant), pousser si le local l'emporte.
    public func syncSettings(
        _ local: SharedSettings, masterKey: String, credentials creds: SyncCredentials
    ) async throws -> SettingsOutcome {
        try await syncSettingsReturningCredentials(
            local, masterKey: masterKey, credentials: creds
        ).0
    }

    /// `syncSettings`, en rendant les identifiants : le sel du compte a pu
    /// être relu, et les jetons renouvelés à cette occasion.
    private func syncSettingsReturningCredentials(
        _ local: SharedSettings, masterKey: String, credentials: SyncCredentials
    ) async throws -> (SettingsOutcome, SyncCredentials) {
        let (salt, creds) = try await accountSalt(credentials)
        let key = try Self.deriveKey(masterKey: masterKey, kdfSalt: salt)
        let url = "\(creds.endpoint)/v1/settings"

        // 204 : corps vide, donc ni nonce ni blob.
        let pulled = try await call(url, method: "GET", bearer: creds.accessToken)
        if let nonce = pulled["nonce"] as? String, let blob = pulled["blob"] as? String {
            // Autre clef maîtresse, autres données associées, format v1 : ignoré.
            guard let nonce = Base64URL.decode(nonce), let blob = Base64URL.decode(blob),
                let remote = Self.openSettings(nonce: nonce, blob: blob, key: key)
            else {
                return (.ignoredRemote, creds)
            }
            if remote.updatedAt >= local.updatedAt { return (.applyRemote(remote), creds) }
        }

        // Jamais modifiés ici : ce sont les valeurs d'usine, pas un choix. Les
        // pousser les imposerait aux autres appareils du compte.
        if local.updatedAt == SharedSettings.neverUpdated { return (.keptLocal, creds) }

        let sealed = try Self.sealSettings(local, key: key)
        _ = try await call(
            url, method: "PUT",
            payload: [
                "nonce": Base64URL.encode(sealed.nonce), "blob": Base64URL.encode(sealed.blob),
            ],
            bearer: creds.accessToken)
        return (.pushedLocal, creds)
    }

    /// Comme `syncSettings`, en renouvelant le jeton d'accès s'il a expiré.
    /// Rend aussi les identifiants, éventuellement renouvelés.
    public func syncSettingsRenewing(
        _ local: SharedSettings, masterKey: String, credentials creds: SyncCredentials
    ) async throws -> (SettingsOutcome, SyncCredentials) {
        do {
            return try await syncSettingsReturningCredentials(
                local, masterKey: masterKey, credentials: creds)
        } catch let error as SyncError where error.status == 401 {
            let renewed = try await refresh(creds).withPlan(creds.plan)
            return try await syncSettingsReturningCredentials(
                local, masterKey: masterKey, credentials: renewed)
        }
    }

    private func decodeRemote(
        _ pulled: [String: Any], fallbackUpdatedAt: String?, key: SymmetricKey
    ) throws -> Vault {
        var remote = Vault()
        remote.updatedAt = fallbackUpdatedAt

        for case let row as [String: Any] in pulled["entries"] as? [Any] ?? [] {
            guard let entryId = row["entry_id"] as? String,
                let nonce = (row["nonce"] as? String).flatMap(Base64URL.decode),
                let blob = (row["blob"] as? String).flatMap(Base64URL.decode)
            else {
                throw SyncError(
                    message: L10nSync.t(
                        "Carnet distant illisible : encodage invalide",
                        "Remote vault unreadable: invalid encoding"))
            }

            var entry: VaultEntry
            do {
                entry = try Self.openEntry(entryId: entryId, nonce: nonce, blob: blob, key: key)
            } catch EntryError.cannotOpen {
                throw SyncError(
                    message: L10nSync.t(
                        "Déchiffrement impossible : la clef maîtresse n'est pas celle "
                            + "qui a servi à synchroniser ce carnet, ou le bloc a été altéré.",
                        "Cannot decrypt: this is not the master key that was used to sync "
                            + "this vault, or the block was altered."))
            } catch {
                // Une entrée illisible, ou qui ne porte pas l'identifiant de
                // sa ligne, est écartée, pas le carnet entier : elle reste
                // telle quelle sur le serveur, qui ne retire rien de ce qu'on
                // ne lui repousse pas.
                continue
            }
            // La pierre tombale du serveur fait foi même si l'entrée chiffrée
            // est antérieure à la suppression.
            if row["deleted"] as? Bool == true { entry.deleted = true }
            remote.entries.append(entry)
        }
        return remote
    }

    private func encodePush(
        baseRevision: Int, entries: [VaultEntry], key: SymmetricKey
    ) throws -> [String: Any] {
        var rows: [[String: Any]] = []
        for entry in entries {
            let sealed = try Self.sealEntry(entry, key: key)
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

/// Réglages par défaut partagés par le compte : ceux d'un site absent du
/// carnet. Voir shared/spec/default-settings.md.
public struct SharedSettings: Codable, Equatable {
    public static let minLength = 4
    public static let maxLength = 40

    public var length: Int
    public var charset: Charset
    public var updatedAt: String

    /// Date des réglages jamais modifiés sur l'appareil : ils perdent contre
    /// ceux du compte et ne sont jamais poussés.
    public static let neverUpdated = "1970-01-01T00:00:00Z"

    public init(length: Int, charset: Charset, updatedAt: String) {
        self.length = length
        self.charset = charset
        self.updatedAt = updatedAt
    }

    /// Longueur ramenée dans les bornes ; `nil` sans aucun jeu coché, qui ne
    /// permettrait pas de générer.
    func validated() -> SharedSettings? {
        let c = charset
        guard c.lower || c.upper || c.symbols || c.numbers else { return nil }
        var copy = self
        copy.length = min(Self.maxLength, max(Self.minLength, length))
        return copy
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
            throw SyncError(
                message: L10nSync.t(
                    "Adresse de service invalide : \(url)", "Invalid service address: \(url)"))
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

/// Localisation minimale des messages d'erreur affichés, dupliquée ici parce
/// que ce fichier est partagé par des cibles qui ne voient pas toutes le même
/// L10n (même raison que `L10nQr`).
enum L10nSync {
    static func t(_ fr: String, _ en: String) -> String {
        (Locale.preferredLanguages.first?.lowercased().hasPrefix("fr") ?? false) ? fr : en
    }
}
