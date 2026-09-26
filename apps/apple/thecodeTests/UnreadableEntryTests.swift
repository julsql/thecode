//
//  UnreadableEntryTests.swift
//  Une entrée illisible ne doit jamais coûter le carnet entier.
//
//  Avant : une seule entrée mal formée faisait échouer le décodage, le
//  chargement repartait d'un carnet vide, et la sauvegarde suivante écrasait le
//  fichier. Désormais l'entrée est écartée, les autres gardées, et le fichier
//  d'origine mis de côté avant toute réécriture.
//

import Compression
import Foundation
import Testing

@testable import TheCode

private let credentials = SyncCredentials(
    endpoint: "https://example.test/api", accessToken: "access-1", refreshToken: "refresh-0")

private func rawEntry(_ entry: VaultEntry) throws -> [String: Any] {
    try JSONSerialization.jsonObject(with: JSONEncoder().encode(entry)) as? [String: Any] ?? [:]
}

/// Un carnet dont la deuxième entrée n'a pas de `siteKey`.
private func vaultData(_ good: [VaultEntry]) throws -> Data {
    var entries: [Any] = try good.map(rawEntry)
    entries.insert(["id": "abimee", "domains": ["x.fr"]], at: min(1, entries.count))
    entries.append("pas une entree")
    return try JSONSerialization.data(withJSONObject: [
        "schema": 1, "updatedAt": "2026-01-01T00:00:00Z", "entries": entries,
    ])
}

private func sample() -> [VaultEntry] {
    [VaultEntry(siteKey: "google.com"), VaultEntry(siteKey: "github.com")]
}

/// Chaque test dans son propre dossier : les copies mises de côté vivent à côté
/// du carnet.
private func tempVaultURL() throws -> URL {
    let dir = FileManager.default.temporaryDirectory
        .appendingPathComponent("vault-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir.appendingPathComponent("vault.json")
}

/// zlib (RFC 1950) : ce que `Transfer.importVault` attend.
private func zlib(_ data: Data) throws -> Data {
    var out = Data([0x78, 0x9C])
    out.append(try (data as NSData).compressed(using: .zlib) as Data)
    var a: UInt32 = 1
    var b: UInt32 = 0
    for byte in data {
        a = (a + UInt32(byte)) % 65521
        b = (b + a) % 65521
    }
    var checksum = ((b << 16) | a).bigEndian
    out.append(Data(bytes: &checksum, count: 4))
    return out
}

/// Serveur figé : rend les lignes données, garde ce qui est poussé.
private actor FrozenServer: SyncTransport {
    let rows: [[String: Any]]
    private(set) var pushedIds: [String] = []

    init(rows: [[String: Any]]) { self.rows = rows }

    func send(url: String, method: String, body: Data?, bearer: String?) async throws
        -> SyncResponse
    {
        if method == "GET" { return reply(["revision": 1, "entries": rows]) }
        let payload =
            (try? JSONSerialization.jsonObject(with: body ?? Data())) as? [String: Any] ?? [:]
        let pushed = payload["entries"] as? [[String: Any]] ?? []
        pushedIds = pushed.compactMap { $0["entry_id"] as? String }
        return reply(["revision": 2, "accepted": pushed.count])
    }

    private func reply(_ body: [String: Any]) -> SyncResponse {
        SyncResponse(
            status: 200, body: (try? JSONSerialization.data(withJSONObject: body)) ?? Data())
    }
}

@Suite("Entrée illisible")
struct UnreadableEntryTests {

    @Test("Le décodage écarte l'entrée illisible et garde les autres")
    func decodingSkipsOnlyTheBadEntry() throws {
        let good = sample()
        let vault = try JSONDecoder().decode(Vault.self, from: vaultData(good))

        #expect(vault.entries.map(\.id) == good.map(\.id))
        #expect(vault.skippedEntries == 2)
    }

    @Test("Un carnet sain n'écarte rien")
    func healthyVaultSkipsNothing() throws {
        let data = try JSONEncoder().encode(Vault(entries: sample()))
        #expect(try JSONDecoder().decode(Vault.self, from: data).skippedEntries == 0)
    }

    @Test("Le compteur d'entrées écartées n'est jamais écrit")
    func skippedCountIsNotEncoded() throws {
        let vault = try JSONDecoder().decode(Vault.self, from: vaultData(sample()))
        let raw = String(decoding: try JSONEncoder().encode(vault), as: UTF8.self)
        #expect(!raw.contains("skipped"))
    }

    @Test("Le chargement garde les entrées lisibles et met l'original de côté")
    func loadKeepsReadableEntries() throws {
        let url = try tempVaultURL()
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let good = sample()
        let original = try vaultData(good)
        try original.write(to: url)

        let loaded = VaultStore.load(from: url)

        #expect(loaded.entries.map(\.id) == good.map(\.id))
        let copies = VaultStore.preservedCopies(of: url)
        #expect(copies.count == 1)
        #expect(try Data(contentsOf: #require(copies.first)) == original)
    }

    @Test("Charger puis sauver ne perd ni les entrées lisibles ni l'original")
    func saveAfterLossyLoadKeepsEverything() throws {
        let url = try tempVaultURL()
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let good = sample()
        let original = try vaultData(good)
        try original.write(to: url)

        try VaultStore.save(VaultStore.load(from: url), to: url)
        try VaultStore.save(VaultStore.load(from: url), to: url)

        #expect(VaultStore.load(from: url).entries.map(\.id) == good.map(\.id))
        let copies = VaultStore.preservedCopies(of: url)
        #expect(copies.count == 1)
        #expect(try Data(contentsOf: #require(copies.first)) == original)
    }

    @Test("Un fichier entièrement illisible est gardé avant d'être remplacé")
    func unreadableFileIsPreserved() throws {
        let url = try tempVaultURL()
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let original = Data("{\"schema\": 1, \"entries\": tronque".utf8)
        try original.write(to: url)

        let loaded = VaultStore.load(from: url)
        #expect(loaded.entries.isEmpty)
        // Le chargement ne touche pas au fichier.
        #expect(try Data(contentsOf: url) == original)

        try VaultStore.save(Vault(entries: [VaultEntry(siteKey: "site.fr")]), to: url)

        let copies = VaultStore.preservedCopies(of: url)
        #expect(copies.count == 1)
        #expect(try Data(contentsOf: #require(copies.first)) == original)
    }

    @Test("Sans pouvoir garder l'original illisible, la sauvegarde refuse d'écrire")
    func refusesToOverwriteWithoutACopy() throws {
        let url = try tempVaultURL()
        let dir = url.deletingLastPathComponent()
        defer {
            try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: dir.path)
            try? FileManager.default.removeItem(at: dir)
        }
        let original = Data("pas du JSON".utf8)
        try original.write(to: url)
        // Dossier en lecture seule : ni copie, ni remplacement atomique possibles.
        try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: dir.path)

        #expect(throws: VaultStore.VaultStoreError.unreadableFileNotPreserved) {
            try VaultStore.save(Vault(), to: url)
        }
        #expect(try Data(contentsOf: url) == original)
    }

    @Test("Un carnet sain n'est pas copié")
    func healthyFileIsNotCopied() throws {
        let url = try tempVaultURL()
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }

        try VaultStore.save(Vault(entries: sample()), to: url)
        try VaultStore.save(VaultStore.load(from: url), to: url)

        #expect(VaultStore.preservedCopies(of: url).isEmpty)
    }

    @Test("L'import garde les entrées lisibles")
    func importSkipsOnlyTheBadEntry() throws {
        let good = sample()
        let sealed = try Transfer.seal(zlib(vaultData(good)), with: Transfer.deriveKey("clef"))
        let payload =
            "\(Transfer.prefix).\(Base64URL.encode(sealed.nonce)).\(Base64URL.encode(sealed.blob))"

        let imported = try Transfer.importVault(payload, masterKey: "clef")

        #expect(imported.entries.map(\.id) == good.map(\.id))
        #expect(imported.skippedEntries == 2)
    }

    @Test("La synchronisation écarte l'entrée distante illisible sans échouer")
    func syncSkipsOnlyTheBadEntry() async throws {
        let key = try Transfer.deriveKey("clef")
        let good = VaultEntry(siteKey: "google.com")
        func row(_ id: String, _ plain: Data) throws -> [String: Any] {
            let sealed = try Transfer.seal(plain, with: key)
            return [
                "entry_id": id, "nonce": Base64URL.encode(sealed.nonce),
                "blob": Base64URL.encode(sealed.blob), "deleted": false,
            ]
        }
        let server = FrozenServer(rows: [
            try row(good.id, JSONEncoder().encode(good)),
            try row("abimee", Data("{\"id\": \"abimee\"}".utf8)),
        ])
        let local = VaultEntry(siteKey: "github.com")

        let result = try await Sync(transport: server)
            .sync(Vault(entries: [local]), masterKey: "clef", credentials: credentials)

        #expect(Set(result.vault.entries.map(\.id)) == [good.id, local.id])
        // L'entrée illisible n'est pas repoussée : le serveur la garde telle quelle.
        #expect(await !server.pushedIds.contains("abimee"))
    }
}
