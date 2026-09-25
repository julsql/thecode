//
//  V2OnlyVaultTests.swift
//  Le carnet n'admet que des entrées v2.
//
//  Vecteur partagé : shared/vault-fixtures/v2-only.json. Toute lecture du
//  carnet (chargement, import, synchronisation) n'en garde que `expectedIds`.
//

import Foundation
import Testing

@testable import TheCode

private struct V2OnlyFixture: Decodable {
    let vault: Vault
    let expectedIds: [String]
}

/// Le vecteur brut, pour l'écrire tel quel sur disque.
private func fixtureData() throws -> Data {
    let url = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .appendingPathComponent("Resources/v2-only.json")
    return try Data(contentsOf: url)
}

/// Le carnet du vecteur, en JSON, sans la clef `expectedIds`.
private func fixtureVaultData() throws -> Data {
    let raw = try JSONSerialization.jsonObject(with: fixtureData()) as? [String: Any] ?? [:]
    return try JSONSerialization.data(withJSONObject: raw["vault"] ?? [:])
}

/// Une entrée d'une autre version, comme en écrivait un ancien client.
private func legacyEntry(_ siteKey: String, v: Int = 1) -> VaultEntry {
    var entry = VaultEntry(siteKey: siteKey)
    entry.v = v
    return entry
}

private let credentials = SyncCredentials(
    endpoint: "https://example.test/api", accessToken: "access-1", refreshToken: "refresh-0")

/// Serveur figé : rend les lignes données, et garde ce qui est poussé.
private actor RecordingServer: SyncTransport {
    let rows: [[String: Any]]
    private(set) var pushed: [[String: Any]] = []

    init(rows: [[String: Any]]) { self.rows = rows }

    func send(url: String, method: String, body: Data?, bearer: String?) async throws
        -> SyncResponse
    {
        if method == "GET" {
            return reply(["revision": 1, "entries": rows])
        }
        let payload =
            (try? JSONSerialization.jsonObject(with: body ?? Data())) as? [String: Any] ?? [:]
        pushed = payload["entries"] as? [[String: Any]] ?? []
        return reply(["revision": 2, "accepted": pushed.count])
    }

    private func reply(_ body: [String: Any]) -> SyncResponse {
        SyncResponse(status: 200, body: (try? JSONSerialization.data(withJSONObject: body)) ?? Data())
    }
}

private func sealedRow(_ entry: VaultEntry, masterKey: String) throws -> [String: Any] {
    let sealed = try Transfer.seal(
        JSONEncoder().encode(entry), with: Transfer.deriveKey(masterKey))
    return [
        "entry_id": entry.id,
        "nonce": Base64URL.encode(sealed.nonce),
        "blob": Base64URL.encode(sealed.blob),
        "deleted": false,
    ]
}

@Suite("Carnet v2 uniquement")
struct V2OnlyVaultTests {

    @Test("Le vecteur partagé ne garde que les entrées attendues")
    func fixtureKeepsExpectedIds() throws {
        let fixture = try JSONDecoder().decode(V2OnlyFixture.self, from: fixtureData())
        #expect(fixture.vault.entries.map(\.id) == fixture.expectedIds)
    }

    @Test("Le chargement écarte la v1 sans vider le carnet")
    func loadDropsLegacyEntriesOnly() throws {
        // Le décodage strict échouait sur tout le carnet, et le chargement
        // retombait sur un carnet vide : la prochaine écriture aurait tout
        // effacé pour une seule entrée v1.
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("vault-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }
        try fixtureVaultData().write(to: url)

        let loaded = VaultStore.load(from: url)
        #expect(loaded.entries.map(\.id) == ["33333333-3333-4333-8333-333333333333"])
        #expect(loaded.entries.first?.login == "moi")
    }

    @Test("Une entrée v2 malformée reste une erreur")
    func malformedV2EntryStillFails() {
        let json = #"{"schema":1,"entries":[{"id":"x","v":2}]}"#
        #expect(throws: (any Error).self) {
            try JSONDecoder().decode(Vault.self, from: Data(json.utf8))
        }
    }

    @Test("Une entrée sans version est écartée")
    func entryWithoutVersionIsDropped() throws {
        let json = #"{"schema":1,"entries":[{"id":"x"}]}"#
        #expect(try JSONDecoder().decode(Vault.self, from: Data(json.utf8)).entries.isEmpty)
    }

    @Test("L'écriture refuse la v1")
    func saveRefusesLegacyEntries() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("vault-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }

        var vault = Vault(entries: [VaultEntry(siteKey: "neuf.fr")])
        vault.entries.append(legacyEntry("vieux.fr"))
        try VaultStore.save(vault, to: url)

        let written = String(decoding: try Data(contentsOf: url), as: UTF8.self)
        #expect(!written.contains("vieux.fr"))
        #expect(VaultStore.load(from: url).entries.map(\.siteKey) == ["neuf.fr"])
    }

    @Test("Un carnet construit avec de la v1 ne la garde pas")
    func initDropsLegacyEntries() {
        let vault = Vault(entries: [legacyEntry("vieux.fr"), VaultEntry(siteKey: "neuf.fr")])
        #expect(vault.entries.map(\.siteKey) == ["neuf.fr"])
    }

    @Test("Une entrée naît toujours en v2")
    func newEntriesAreV2() {
        #expect(VaultEntry(siteKey: "neuf.fr").v == 2)
    }

    @Test("La fusion écarte la v1 et les versions futures")
    func mergeDropsOtherVersions() {
        var left = Vault(entries: [VaultEntry(siteKey: "a.fr")])
        left.entries.append(legacyEntry("vieux.fr"))
        var right = Vault(entries: [VaultEntry(siteKey: "b.fr")])
        right.entries.append(legacyEntry("futur.fr", v: 3))

        let (merged, conflicts) = Vault.merge(left, right)
        #expect(Set(merged.entries.map(\.siteKey)) == ["a.fr", "b.fr"])
        #expect(conflicts.isEmpty)
    }

    @Test("L'enregistrement ne rattache jamais un site à une entrée v1")
    func upsertIgnoresLegacyEntries() {
        var vault = Vault()
        vault.entries.append(legacyEntry("vieux.fr"))

        let saved = vault.upsert(site: "vieux.fr", length: 16, charset: Charset())
        #expect(saved.v == 2)
        #expect(saved.counter == 1)
    }

    @Test("Le transfert ne transporte pas la v1")
    func transferDropsLegacyEntries() throws {
        var vault = Vault(entries: [VaultEntry(siteKey: "neuf.fr")])
        vault.entries.append(legacyEntry("vieux.fr"))

        let payload = try Transfer.exportVault(vault, masterKey: "clef")
        let imported = try Transfer.importVault(payload, masterKey: "clef")
        #expect(imported.entries.map(\.siteKey) == ["neuf.fr"])
    }

    @Test("La synchronisation écarte la v1 reçue et ne la repousse pas")
    func syncDropsLegacyEntries() async throws {
        let modern = VaultEntry(siteKey: "neuf.fr")
        let old = legacyEntry("vieux.fr")
        let server = RecordingServer(rows: [
            try sealedRow(old, masterKey: "clef"),
            try sealedRow(modern, masterKey: "clef"),
        ])

        let result = try await Sync(transport: server)
            .sync(Vault(), masterKey: "clef", credentials: credentials)

        #expect(result.vault.entries.map(\.id) == [modern.id])
        let pushedIds = await server.pushed.compactMap { $0["entry_id"] as? String }
        #expect(pushedIds == [modern.id])
    }
}
