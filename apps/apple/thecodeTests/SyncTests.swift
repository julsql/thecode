//
//  SyncTests.swift
//  Synchronisation chiffrée du carnet.
//
//  Ce qui compte : ce que l'appareil envoie sur le réseau, et le fait que deux
//  appareils convergent. Un vrai serveur ne dirait rien de plus et rendrait les
//  tests lents et instables.
//

import Foundation
import Testing

@testable import TheCode

/// Serveur de carnet en mémoire, aux mêmes règles que l'API réelle.
private actor FakeVaultServer: SyncTransport {

    private var rows: [String: [String: Any]] = [:]
    private(set) var revision = 0
    private(set) var refreshCount = 0

    /// Tout ce qui est passé sur le réseau, pour vérifier l'absence de clair.
    private(set) var sentBodies: [String] = []
    /// « MÉTHODE url » de chaque appel, dans l'ordre.
    private(set) var requests: [String] = []

    private var validAccessToken: String
    /// Plafond d'entrées du compte, rendu au pull ; nil : le serveur n'en dit rien.
    private let maxEntries: Int?

    /// Réglages par défaut du compte : un seul blob, que le serveur ne lit pas.
    private(set) var settings: [String: Any]?
    private(set) var settingsPuts = 0

    func seedSettings(_ value: [String: Any]?) { settings = value }

    init(validAccessToken: String = "access-1", maxEntries: Int? = nil) {
        self.validAccessToken = validAccessToken
        self.maxEntries = maxEntries
    }

    func send(url: String, method: String, body: Data?, bearer: String?) async throws
        -> SyncResponse
    {
        if let body { sentBodies.append(String(decoding: body, as: UTF8.self)) }
        requests.append("\(method) \(url)")

        if url.hasSuffix("/v1/auth/logout") {
            return SyncResponse(status: 204, body: Data())
        }
        if url.hasSuffix("/v1/auth/refresh") {
            refreshCount += 1
            validAccessToken = "access-\(refreshCount + 1)"
            return json(200, ["access_token": validAccessToken, "refresh_token": "refresh-1"])
        }
        if url.hasSuffix("/v1/auth/login") || url.hasSuffix("/v1/auth/register") {
            return json(200, ["access_token": validAccessToken, "refresh_token": "refresh-0"])
        }

        guard bearer == validAccessToken else {
            return json(401, ["detail": "Jeton expiré"])
        }
        if url.hasSuffix("/v1/settings") {
            if method == "PUT" {
                settings =
                    (try? JSONSerialization.jsonObject(with: body ?? Data())) as? [String: Any]
                settingsPuts += 1
                return SyncResponse(status: 204, body: Data())
            }
            guard let settings else { return SyncResponse(status: 204, body: Data()) }
            return json(200, settings)
        }
        return method == "GET" ? pull() : push(body)
    }

    private func pull() -> SyncResponse {
        var body: [String: Any] = ["revision": revision, "entries": Array(rows.values)]
        if let maxEntries { body["max_entries"] = maxEntries }
        return json(200, body)
    }

    private func push(_ body: Data?) -> SyncResponse {
        let payload =
            (try? JSONSerialization.jsonObject(with: body ?? Data())) as? [String: Any] ?? [:]

        guard payload["base_revision"] as? Int == revision else {
            // Écraser reviendrait à perdre en silence ce qu'un autre appareil a
            // écrit entre-temps.
            return json(409, ["detail": "Le carnet a changé depuis (révision \(revision))"])
        }

        revision += 1
        let entries = payload["entries"] as? [[String: Any]] ?? []
        for entry in entries {
            rows[entry["entry_id"] as? String ?? ""] = entry
        }
        return json(200, ["revision": revision, "accepted": entries.count])
    }

    private func json(_ status: Int, _ body: [String: Any]) -> SyncResponse {
        SyncResponse(
            status: status, body: (try? JSONSerialization.data(withJSONObject: body)) ?? Data())
    }
}

/// Transport figé, pour les cas d'erreur qui n'ont pas besoin d'état.
private struct StubTransport: SyncTransport {
    let handler: @Sendable (String, String) throws -> SyncResponse

    func send(url: String, method: String, body: Data?, bearer: String?) async throws
        -> SyncResponse
    {
        try handler(url, method)
    }
}

private let credentials = SyncCredentials(
    endpoint: "https://example.test/api", accessToken: "access-1", refreshToken: "refresh-0")

private func vault(siteKey: String, login: String) -> Vault {
    var entry = VaultEntry(siteKey: siteKey, domains: [siteKey])
    entry.login = login
    return Vault(entries: [entry])
}

@Suite("Synchronisation")
struct SyncTests {

    @Test("Rien de lisible ne passe sur le réseau")
    func sendsNothingReadable() async throws {
        let server = FakeVaultServer()
        _ = try await Sync(transport: server)
            .sync(vault(siteKey: "banque-secrete.fr", login: "utilisateur"),
                masterKey: "clef", credentials: credentials)

        let bodies = await server.sentBodies
        #expect(!bodies.isEmpty)
        for body in bodies {
            // Le serveur ne doit rien apprendre : ni le site, ni l'identifiant.
            #expect(!body.contains("banque-secrete"))
            #expect(!body.contains("utilisateur"))
        }
    }

    @Test("Deux appareils convergent")
    func twoDevicesConverge() async throws {
        let server = FakeVaultServer()
        let sync = Sync(transport: server)

        var phone = try await sync.sync(
            vault(siteKey: "google.com", login: "moi"), masterKey: "clef",
            credentials: credentials
        ).vault
        let laptop = try await sync.sync(
            vault(siteKey: "github.com", login: "julsql"), masterKey: "clef",
            credentials: credentials
        ).vault
        phone = try await sync.sync(phone, masterKey: "clef", credentials: credentials).vault

        #expect(laptop.entries.count == 2)
        #expect(phone.entries.count == 2)
        #expect(phone.find(domain: "github.com") != nil)
        #expect(laptop.find(domain: "google.com") != nil)
    }

    @Test("Au-delà du plafond, ne pousse que les plus anciennes")
    func pushesOnlyTheOldestBeyondTheLimit() async throws {
        let server = FakeVaultServer(maxEntries: 2)
        var local = Vault()
        for (site, created) in [
            ("recent.fr", "2026-03-01T00:00:00Z"),
            ("ancien.fr", "2026-01-01T00:00:00Z"),
            ("moyen.fr", "2026-02-01T00:00:00Z"),
        ] {
            var entry = VaultEntry(siteKey: site)
            entry.createdAt = created
            local.entries.append(entry)
        }

        let result = try await Sync(transport: server)
            .sync(local, masterKey: "clef", credentials: credentials)

        let push = try #require(await server.sentBodies.first)
        let payload = try #require(
            try JSONSerialization.jsonObject(with: Data(push.utf8)) as? [String: Any])
        let pushed = (payload["entries"] as? [[String: Any]] ?? [])
            .compactMap { $0["entry_id"] as? String }.sorted()
        let bySite = { (site: String) in local.entries.first { $0.siteKey == site }!.id }
        #expect(pushed == [bySite("ancien.fr"), bySite("moyen.fr")].sorted())
        // L'entrée en trop reste dans le carnet local.
        #expect(result.localOnly == 1)
        #expect(result.vault.entries.count == 3)
    }

    @Test("Un serveur sans plafond reçoit tout")
    func pushesEverythingWithoutALimit() async throws {
        let result = try await Sync(transport: FakeVaultServer())
            .sync(vault(siteKey: "google.com", login: "moi"), masterKey: "clef",
                credentials: credentials)
        #expect(result.localOnly == 0)
    }

    @Test("Une suppression se propage")
    func propagatesTombstones() async throws {
        let server = FakeVaultServer()
        let sync = Sync(transport: server)

        var phone = try await sync.sync(
            vault(siteKey: "google.com", login: "moi"), masterKey: "clef",
            credentials: credentials
        ).vault
        let deletedId = phone.entries[0].id
        phone.entries[0].deleted = true
        phone.entries[0].updatedAt = "2999-01-01T00:00:00Z"
        _ = try await sync.sync(phone, masterKey: "clef", credentials: credentials)

        // Sans pierre tombale, la fusion suivante ressusciterait l'entrée
        // depuis l'autre appareil.
        //
        // La recherche se fait par identifiant : la fusion trie par id, et
        // l'ordinateur apporte sa propre entrée, d'identifiant aléatoire.
        let laptop = try await sync.sync(
            vault(siteKey: "google.com", login: "moi"), masterKey: "clef",
            credentials: credentials
        ).vault
        #expect(laptop.entries.first { $0.id == deletedId }?.deleted == true)
    }

    @Test("Une autre clef maîtresse ne peut pas ouvrir le carnet")
    func refusesAnotherMasterKey() async throws {
        let server = FakeVaultServer()
        let sync = Sync(transport: server)
        _ = try await sync.sync(
            vault(siteKey: "google.com", login: "moi"), masterKey: "clef",
            credentials: credentials)

        await #expect(throws: SyncError.self) {
            _ = try await sync.sync(Vault(), masterKey: "mauvaise", credentials: credentials)
        }

        do {
            _ = try await sync.sync(Vault(), masterKey: "mauvaise", credentials: credentials)
        } catch let error as SyncError {
            // Message explicite : sinon on croirait à une panne du service.
            #expect(
                error.message.contains("clef maîtresse") || error.message.contains("master key"))
        }
    }

    @Test("Un jeton expiré est renouvelé")
    func renewsAnExpiredToken() async throws {
        let server = FakeVaultServer(validAccessToken: "expiré")

        let result = try await Sync(transport: server)
            .syncRenewing(
                vault(siteKey: "google.com", login: "moi"), masterKey: "clef",
                credentials: credentials)

        #expect(await server.refreshCount == 1)
        #expect(result.credentials.accessToken == "access-2")
        #expect(await server.revision == 1)
    }

    @Test("Une révision périmée est signalée, jamais écrasée")
    func reportsAStaleRevision() async throws {
        let transport = StubTransport { _, method in
            method == "GET"
                ? SyncResponse(status: 200, body: Data(#"{"revision":3,"entries":[]}"#.utf8))
                // Un autre appareil a écrit entre le pull et le push.
                : SyncResponse(status: 409, body: Data(#"{"detail":"révision 4"}"#.utf8))
        }

        do {
            _ = try await Sync(transport: transport)
                .sync(Vault(), masterKey: "clef", credentials: credentials)
            Issue.record("un push sur une révision périmée a été accepté")
        } catch let error as SyncError {
            #expect(error.status == 409)
        }
    }

    @Test("Une erreur serveur remonte avec son message")
    func surfacesServerErrors() async throws {
        let transport = StubTransport { _, _ in
            SyncResponse(status: 500, body: Data(#"{"detail":"base indisponible"}"#.utf8))
        }

        do {
            _ = try await Sync(transport: transport)
                .sync(Vault(), masterKey: "clef", credentials: credentials)
            Issue.record("une erreur serveur a été avalée")
        } catch let error as SyncError {
            #expect(error.status == 500)
            #expect(error.message.contains("base indisponible"))
        }
    }

    @Test("Un service injoignable est signalé comme tel")
    func reportsUnreachableService() async throws {
        struct Offline: Error {}
        let transport = StubTransport { _, _ in throw Offline() }

        do {
            _ = try await Sync(transport: transport)
                .sync(Vault(), masterKey: "clef", credentials: credentials)
            Issue.record("une panne réseau a été avalée")
        } catch let error as SyncError {
            #expect(error.message.contains("injoignable") || error.message.contains("unreachable"))
        }
    }

    @Test("Un désaccord sur le siteKey est signalé au lieu d'être tranché")
    func reportsAMergeConflict() async throws {
        let server = FakeVaultServer()
        let sync = Sync(transport: server)

        let phone = vault(siteKey: "google.com", login: "moi")
        _ = try await sync.sync(phone, masterKey: "clef", credentials: credentials)

        // Le siteKey produit le mot de passe : trancher en silence le
        // changerait sans prévenir.
        var other = VaultEntry(siteKey: "google.fr", domains: ["google.fr"])
        other.id = phone.entries[0].id

        let conflicts = try await sync.sync(
            Vault(entries: [other]), masterKey: "clef", credentials: credentials
        ).conflicts
        #expect(conflicts.count == 1)
        #expect(conflicts[0].kind == "sitekey-divergent")
    }

    @Test("Base64 url-safe, sans remplissage")
    func base64IsUrlSafe() {
        // C'est l'encodage que l'API attend et que les autres implémentations
        // produisent : un « + » ou un « = » casserait l'interopérabilité.
        let raw = Data([0xFB, 0xFF])
        #expect(Base64URL.encode(raw) == "-_8")
        #expect(Base64URL.decode("-_8") == raw)
        #expect(Base64URL.decode("+/8=") == raw)
    }
}

// MARK: - Déconnexion

@Suite("Déconnexion")
struct SignOutTests {

    @Test("La déconnexion révoque la session avec le jeton de renouvellement")
    func logoutSendsTheRefreshToken() async throws {
        let server = FakeVaultServer()

        await Sync(transport: server).logout(credentials: credentials)

        #expect(await server.requests == ["POST https://example.test/api/v1/auth/logout"])
        let body = try #require(await server.sentBodies.first)
        let payload = try #require(
            try JSONSerialization.jsonObject(with: Data(body.utf8)) as? [String: String])
        #expect(payload == ["refresh_token": "refresh-0"])
    }

    @Test("Un refus de révocation ne renouvelle pas le jeton")
    func logoutNeverRefreshes() async {
        let transport = StubTransport { url, _ in
            if !url.hasSuffix("/v1/auth/logout") { Issue.record("appel inattendu : \(url)") }
            return SyncResponse(status: 401, body: Data(#"{"detail":"Session inconnue"}"#.utf8))
        }

        await Sync(transport: transport).logout(credentials: credentials)
    }

    @Test("Révocation d'abord, puis oubli local")
    func signOutRevokesThenForgets() async {
        let server = FakeVaultServer()
        var forgotten = false

        await AutoSync.signOut(credentials: credentials, sync: Sync(transport: server)) {
            forgotten = true
        }

        #expect(await server.requests.count == 1)
        #expect(forgotten)
    }

    @Test("Service injoignable : la déconnexion locale a lieu quand même")
    func signOutForgetsEvenOffline() async {
        struct Offline: Error {}
        let transport = StubTransport { _, _ in throw Offline() }
        var forgotten = false

        await AutoSync.signOut(credentials: credentials, sync: Sync(transport: transport)) {
            forgotten = true
        }

        #expect(forgotten)
    }

    @Test("Erreur serveur : la déconnexion locale a lieu quand même")
    func signOutForgetsOnServerError() async {
        let transport = StubTransport { _, _ in
            SyncResponse(status: 500, body: Data(#"{"detail":"base indisponible"}"#.utf8))
        }
        var forgotten = false

        await AutoSync.signOut(credentials: credentials, sync: Sync(transport: transport)) {
            forgotten = true
        }

        #expect(forgotten)
    }

    @Test("Sans jetons, rien ne part et l'oubli local a lieu")
    func signOutWithoutCredentials() async {
        let server = FakeVaultServer()
        var forgotten = false

        await AutoSync.signOut(credentials: nil, sync: Sync(transport: server)) {
            forgotten = true
        }

        #expect(await server.requests.isEmpty)
        #expect(forgotten)
    }
}

// MARK: - Réglages par défaut

private func settings(
    length: Int = 20, symbols: Bool = true, at updatedAt: String
) -> SharedSettings {
    SharedSettings(length: length, charset: Charset(symbols: symbols), updatedAt: updatedAt)
}

/// Ce qu'un autre appareil aurait déposé sur le compte.
private func sealedSettings(_ value: SharedSettings, masterKey: String = "clef") throws
    -> [String: Any]
{
    let sealed = try Transfer.seal(
        JSONEncoder().encode(value), with: Transfer.deriveKey(masterKey))
    return ["nonce": Base64URL.encode(sealed.nonce), "blob": Base64URL.encode(sealed.blob)]
}

private func openSettings(_ row: [String: Any]?, masterKey: String = "clef") throws
    -> SharedSettings
{
    let nonce = try #require(Base64URL.decode(row?["nonce"] as? String ?? ""))
    let blob = try #require(Base64URL.decode(row?["blob"] as? String ?? ""))
    return try JSONDecoder().decode(
        SharedSettings.self,
        from: Transfer.open(nonce: nonce, blob: blob, with: Transfer.deriveKey(masterKey)))
}

private func freshDefaults() -> UserDefaults {
    let name = "thecode-tests-\(UUID().uuidString)"
    let defaults = UserDefaults(suiteName: name)!
    defaults.removePersistentDomain(forName: name)
    return defaults
}

@Suite("Synchronisation des réglages par défaut")
struct SettingsSyncTests {

    @Test("Des réglages jamais modifiés ne sont jamais poussés")
    func neverPushesUntouchedSettings() async throws {
        let server = FakeVaultServer()
        let local = settings(length: 20, symbols: true, at: SharedSettings.neverUpdated)

        let outcome = try await Sync(transport: server)
            .syncSettings(local, masterKey: "clef", credentials: credentials)

        #expect(outcome == .keptLocal)
        #expect(await server.settings == nil)
    }

    @Test("Sans réglages sur le compte, les locaux sont poussés, chiffrés")
    func pushesWhenTheAccountHasNone() async throws {
        let server = FakeVaultServer()
        let local = settings(length: 32, symbols: false, at: "2026-01-15T10:30:00Z")

        let outcome = try await Sync(transport: server)
            .syncSettings(local, masterKey: "clef", credentials: credentials)

        #expect(outcome == .pushedLocal)
        #expect(try openSettings(await server.settings) == local)
        let bodies = await server.sentBodies
        #expect(!bodies.contains { $0.contains("updatedAt") || $0.contains("length") })
    }

    @Test("La valeur distante plus récente l'emporte, sans rien pousser")
    func remoteNewerWins() async throws {
        let server = FakeVaultServer()
        let remote = settings(length: 12, at: "2026-02-01T00:00:00Z")
        await server.seedSettings(try sealedSettings(remote))

        let outcome = try await Sync(transport: server).syncSettings(
            settings(at: "2026-01-01T00:00:00Z"), masterKey: "clef", credentials: credentials)

        #expect(outcome == .applyRemote(remote))
        #expect(await server.settingsPuts == 0)
    }

    @Test("À égalité, la distante l'emporte")
    func tieGoesToRemote() async throws {
        let server = FakeVaultServer()
        let remote = settings(length: 12, at: "2026-02-01T00:00:00Z")
        await server.seedSettings(try sealedSettings(remote))

        let outcome = try await Sync(transport: server).syncSettings(
            settings(length: 30, at: "2026-02-01T00:00:00Z"), masterKey: "clef",
            credentials: credentials)

        #expect(outcome == .applyRemote(remote))
    }

    @Test("La valeur locale plus récente remplace la distante")
    func localNewerIsPushed() async throws {
        let server = FakeVaultServer()
        await server.seedSettings(
            try sealedSettings(settings(length: 12, at: "2026-01-01T00:00:00Z")))
        let local = settings(length: 30, at: "2026-03-01T00:00:00Z")

        let outcome = try await Sync(transport: server)
            .syncSettings(local, masterKey: "clef", credentials: credentials)

        #expect(outcome == .pushedLocal)
        #expect(try openSettings(await server.settings) == local)
    }

    @Test("Un blob d'une autre clef maîtresse est ignoré, des deux côtés")
    func ignoresAnotherMasterKey() async throws {
        let server = FakeVaultServer()
        let foreign = try sealedSettings(settings(at: "2026-01-01T00:00:00Z"), masterKey: "autre")
        await server.seedSettings(foreign)

        let outcome = try await Sync(transport: server).syncSettings(
            settings(length: 30, at: "2026-03-01T00:00:00Z"), masterKey: "clef",
            credentials: credentials)

        #expect(outcome == .ignoredRemote)
        #expect(await server.settingsPuts == 0)
        #expect(await server.settings?["blob"] as? String == foreign["blob"] as? String)
    }

    @Test("Des réglages distants sans aucun jeu sont ignorés")
    func ignoresUnusableRemote() async throws {
        let server = FakeVaultServer()
        var empty = settings(at: "2026-05-01T00:00:00Z")
        empty.charset = Charset(lower: false, upper: false, symbols: false, numbers: false)
        await server.seedSettings(try sealedSettings(empty))

        let outcome = try await Sync(transport: server).syncSettings(
            settings(at: "2026-01-01T00:00:00Z"), masterKey: "clef", credentials: credentials)

        #expect(outcome == .ignoredRemote)
    }

    @Test("Une longueur distante hors bornes est ramenée dans les bornes")
    func clampsRemoteLength() async throws {
        let server = FakeVaultServer()
        await server.seedSettings(
            try sealedSettings(settings(length: 99, at: "2026-05-01T00:00:00Z")))

        let outcome = try await Sync(transport: server).syncSettings(
            settings(at: "2026-01-01T00:00:00Z"), masterKey: "clef", credentials: credentials)

        #expect(outcome == .applyRemote(settings(length: 40, at: "2026-05-01T00:00:00Z")))
    }

    @Test("Un jeton expiré est renouvelé, l'offre gardée")
    func renewsAnExpiredToken() async throws {
        let server = FakeVaultServer(validAccessToken: "expiré")
        let creds = credentials.withPlan(SyncPlan.pro)

        let (outcome, renewed) = try await Sync(transport: server).syncSettingsRenewing(
            settings(at: "2026-01-01T00:00:00Z"), masterKey: "clef", credentials: creds)

        #expect(outcome == .pushedLocal)
        #expect(renewed.accessToken == "access-2")
        #expect(renewed.plan == SyncPlan.pro)
    }

    // MARK: Réglages retenus sur l'appareil

    @Test("Une modification locale est datée, une écriture identique ne l'est pas")
    func touchDatesOnlyRealChanges() {
        let defaults = freshDefaults()
        defaults.set(24, forKey: PasswordSettings.Key.lengthNumber)
        PasswordSettings.touch(defaults, now: "2026-01-01T00:00:00Z")
        #expect(PasswordSettings.shared(from: defaults).updatedAt == "2026-01-01T00:00:00Z")

        PasswordSettings.touch(defaults, now: "2026-02-01T00:00:00Z")
        #expect(PasswordSettings.shared(from: defaults).updatedAt == "2026-01-01T00:00:00Z")

        defaults.set(false, forKey: PasswordSettings.Key.symState)
        PasswordSettings.touch(defaults, now: "2026-03-01T00:00:00Z")
        let shared = PasswordSettings.shared(from: defaults)
        #expect(shared.updatedAt == "2026-03-01T00:00:00Z")
        #expect(shared.length == 24)
        #expect(shared.charset.symbols == false)
    }

    @Test("Des réglages jamais modifiés perdent contre ceux du compte")
    func neverTouchedLosesToRemote() {
        let defaults = freshDefaults()
        PasswordSettings.touch(defaults, now: "2026-09-01T00:00:00Z", datesFirstStamp: false)
        #expect(PasswordSettings.shared(from: defaults).updatedAt == PasswordSettings.neverUpdated)
    }

    @Test("Des réglages appliqués ne sont pas redatés par l'écran qui les relit")
    func appliedSettingsAreNotRedated() {
        let defaults = freshDefaults()
        let remote = settings(length: 12, symbols: false, at: "2026-02-01T00:00:00Z")

        PasswordSettings.apply(remote, to: defaults)
        PasswordSettings.touch(defaults, now: "2026-09-01T00:00:00Z")

        #expect(PasswordSettings.shared(from: defaults) == remote)
        #expect(defaults.integer(forKey: PasswordSettings.Key.lengthNumber) == 12)
        #expect(defaults.bool(forKey: PasswordSettings.Key.symState) == false)
    }

    @Test("Deux appareils finissent sur les réglages les plus récents")
    func twoDevicesConverge() async throws {
        let server = FakeVaultServer()
        let sync = Sync(transport: server)
        let phone = freshDefaults()
        let laptop = freshDefaults()

        phone.set(16, forKey: PasswordSettings.Key.lengthNumber)
        PasswordSettings.touch(phone, now: "2026-01-01T00:00:00Z")
        try await PasswordSettings.syncShared(
            masterKey: "clef", credentials: credentials, defaults: phone, sync: sync)

        // Le portable n'a jamais rien modifié : il reprend ceux du compte.
        try await PasswordSettings.syncShared(
            masterKey: "clef", credentials: credentials, defaults: laptop, sync: sync)
        #expect(PasswordSettings.load(from: laptop).length == 16)

        laptop.set(false, forKey: PasswordSettings.Key.chiState)
        PasswordSettings.touch(laptop, now: "2026-02-01T00:00:00Z")
        try await PasswordSettings.syncShared(
            masterKey: "clef", credentials: credentials, defaults: laptop, sync: sync)
        try await PasswordSettings.syncShared(
            masterKey: "clef", credentials: credentials, defaults: phone, sync: sync)

        #expect(PasswordSettings.load(from: phone).chiState == false)
        #expect(PasswordSettings.load(from: phone).length == 16)
        #expect(PasswordSettings.shared(from: phone) == PasswordSettings.shared(from: laptop))
    }

    @Test("Une autre clef maîtresse ne touche pas aux réglages locaux")
    func foreignBlobLeavesLocalAlone() async throws {
        let server = FakeVaultServer()
        await server.seedSettings(
            try sealedSettings(
                settings(length: 8, at: "2026-09-01T00:00:00Z"), masterKey: "autre"))
        let defaults = freshDefaults()
        defaults.set(30, forKey: PasswordSettings.Key.lengthNumber)
        PasswordSettings.touch(defaults, now: "2026-01-01T00:00:00Z")

        try await PasswordSettings.syncShared(
            masterKey: "clef", credentials: credentials, defaults: defaults,
            sync: Sync(transport: server))

        #expect(PasswordSettings.load(from: defaults).length == 30)
        #expect(await server.settingsPuts == 0)
    }
}
