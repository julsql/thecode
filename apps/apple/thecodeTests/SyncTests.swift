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

    private var validAccessToken: String

    init(validAccessToken: String = "access-1") {
        self.validAccessToken = validAccessToken
    }

    func send(url: String, method: String, body: Data?, bearer: String?) async throws
        -> SyncResponse
    {
        if let body { sentBodies.append(String(decoding: body, as: UTF8.self)) }

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
        return method == "GET" ? pull() : push(body)
    }

    private func pull() -> SyncResponse {
        json(200, ["revision": revision, "entries": Array(rows.values)])
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

    @Test("Une suppression se propage")
    func propagatesTombstones() async throws {
        let server = FakeVaultServer()
        let sync = Sync(transport: server)

        var phone = try await sync.sync(
            vault(siteKey: "google.com", login: "moi"), masterKey: "clef",
            credentials: credentials
        ).vault
        phone.entries[0].deleted = true
        phone.entries[0].updatedAt = "2999-01-01T00:00:00Z"
        _ = try await sync.sync(phone, masterKey: "clef", credentials: credentials)

        // Sans pierre tombale, la fusion suivante ressusciterait l'entrée
        // depuis l'autre appareil.
        let laptop = try await sync.sync(
            vault(siteKey: "google.com", login: "moi"), masterKey: "clef",
            credentials: credentials
        ).vault
        #expect(laptop.entries[0].deleted == true)
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
            #expect(error.message.contains("clef maîtresse"))
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
            #expect(error.message.contains("injoignable"))
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
