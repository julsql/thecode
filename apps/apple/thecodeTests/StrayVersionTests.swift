//
//  StrayVersionTests.swift
//  Une entrée ne porte pas de version : un « v » résiduel est ignoré.
//
//  Toute entrée du carnet dérive en v2. Un champ `v` lu (chargement, import,
//  synchronisation, fusion) est toléré, retiré, et jamais réécrit. Voir
//  shared/spec/vault-merge.md et apps/cli/tests/test_stray_version.py.
//

import Compression
import Foundation
import Testing

@testable import TheCode

private let credentials = SyncCredentials(
    endpoint: "https://example.test/api", accessToken: "access-1", refreshToken: "refresh-0")

/// Une entrée telle que l'écrivait un ancien client : avec un `v`.
private func strayEntry(_ entry: VaultEntry, v: Int) throws -> [String: Any] {
    var raw =
        try JSONSerialization.jsonObject(with: JSONEncoder().encode(entry)) as? [String: Any]
        ?? [:]
    raw["v"] = v
    return raw
}

private func strayVaultData(_ entry: VaultEntry, v: Int = 1) throws -> Data {
    try JSONSerialization.data(withJSONObject: [
        "schema": 1, "updatedAt": entry.updatedAt, "entries": [try strayEntry(entry, v: v)],
    ])
}

private func sampleEntry() -> VaultEntry {
    VaultEntry(siteKey: "google.com", domains: ["google.com"], login: "moi")
}

private func hasV(_ data: Data) throws -> Bool {
    let raw = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    let entries = raw["entries"] as? [[String: Any]] ?? [raw]
    return entries.contains { $0["v"] != nil }
}

private func tempURL() -> URL {
    FileManager.default.temporaryDirectory
        .appendingPathComponent("vault-\(UUID().uuidString).json")
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
        SyncResponse(
            status: 200, body: (try? JSONSerialization.data(withJSONObject: body)) ?? Data())
    }
}

@Suite("Version résiduelle d'une entrée")
struct StrayVersionTests {

    @Test("Une nouvelle entrée ne porte pas de version")
    func newEntryHasNoVersion() throws {
        #expect(try !hasV(JSONEncoder().encode(VaultEntry(siteKey: "site.fr"))))
    }

    @Test("Le chargement garde l'entrée et retire v", arguments: [1, 2, 3])
    func loadKeepsTheEntryAndDropsV(v: Int) throws {
        let url = tempURL()
        defer { try? FileManager.default.removeItem(at: url) }
        let entry = sampleEntry()
        try strayVaultData(entry, v: v).write(to: url)

        let loaded = VaultStore.load(from: url)

        #expect(loaded.entries.map(\.id) == [entry.id])
        #expect(try !hasV(JSONEncoder().encode(loaded)))
    }

    @Test("L'écriture ne réécrit jamais v")
    func saveNeverWritesVBack() throws {
        let url = tempURL()
        defer { try? FileManager.default.removeItem(at: url) }
        try strayVaultData(sampleEntry()).write(to: url)

        try VaultStore.save(VaultStore.load(from: url), to: url)

        #expect(try !hasV(Data(contentsOf: url)))
    }

    @Test("L'import retire v")
    func importDropsV() throws {
        let entry = sampleEntry()
        let sealed = try Transfer.seal(
            zlib(strayVaultData(entry)), with: Transfer.deriveKey("clef"))
        let payload =
            "\(Transfer.prefix).\(Base64URL.encode(sealed.nonce)).\(Base64URL.encode(sealed.blob))"

        let imported = try Transfer.importVault(payload, masterKey: "clef")

        #expect(imported.entries.map(\.id) == [entry.id])
        #expect(try !hasV(JSONEncoder().encode(imported)))
    }

    @Test("La fusion retire v")
    func mergeDropsV() throws {
        let entry = sampleEntry()
        let stray = try JSONDecoder().decode(Vault.self, from: strayVaultData(entry))

        let (merged, _) = Vault.merge(Vault(), stray)

        #expect(merged.entries.map(\.id) == [entry.id])
        #expect(try !hasV(JSONEncoder().encode(merged)))
    }

    @Test("La synchronisation garde l'entrée et ne repousse pas v")
    func syncDropsV() async throws {
        let entry = sampleEntry()
        let key = try Transfer.deriveKey("clef")
        let sealed = try Transfer.seal(
            JSONSerialization.data(withJSONObject: try strayEntry(entry, v: 1)), with: key)
        let server = RecordingServer(rows: [[
            "entry_id": entry.id,
            "nonce": Base64URL.encode(sealed.nonce),
            "blob": Base64URL.encode(sealed.blob),
            "deleted": false,
        ]])

        let result = try await Sync(transport: server)
            .sync(Vault(), masterKey: "clef", credentials: credentials)

        #expect(result.vault.entries.map(\.id) == [entry.id])
        #expect(try !hasV(JSONEncoder().encode(result.vault)))

        let pushed = await server.pushed
        #expect(pushed.count == 1)
        for row in pushed {
            let nonce = try #require(Base64URL.decode(row["nonce"] as? String ?? ""))
            let blob = try #require(Base64URL.decode(row["blob"] as? String ?? ""))
            let plain = try Transfer.open(nonce: nonce, blob: blob, with: key)
            #expect(try !hasV(plain))
        }
    }

    @Test("Une entrée au v1 résiduel dérive quand même en v2")
    func strayV1StillDerivesV2() throws {
        let entry = sampleEntry()
        let loaded = try JSONDecoder().decode(Vault.self, from: strayVaultData(entry, v: 1))
        let resolution = SiteResolution(entry: try #require(loaded.entries.first))

        let utils = PasswordUtils()
        utils.longueur = entry.length
        let expected = utils.generatePasswordV2(
            masterKey: "clef", siteKey: "google.com", login: "moi", counter: 1)

        #expect(resolution.v == 2)
        #expect(
            PasswordUtils().generatePassword(for: resolution, masterKey: "clef").code
                == expected.code)
    }
}
