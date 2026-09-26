//
//  SyncTamperTests.swift
//  Un blob valide rangé sous un autre identifiant arrête toute la
//  synchronisation (shared/spec/vault-sync.md, déchiffrement, point 3).
//
//  Le cas vient du vecteur partagé `sync-row.json` (`rejected`, `id-mismatch`),
//  lu depuis les sources via #filePath comme les autres ressources de la cible.
//

import Foundation
import Testing

@testable import TheCode_for_Mac

private struct TamperVector: Decodable {
    let masterKey: String
    let kdfSalt: String
    let rejected: [Case]

    struct Case: Decodable {
        let name: String
        let row: Row
    }

    struct Row: Decodable {
        /// Absent des cas « réglages ».
        let entryId: String?
        let nonce: String
        let blob: String

        private enum CodingKeys: String, CodingKey {
            case entryId = "entry_id"
            case nonce, blob
        }
    }
}

/// Rend une seule ligne au pull ; compte les poussées, qui ne doivent pas avoir lieu.
private final class PullOnlyServer: SyncTransport {
    let row: [String: Any]
    private(set) var posts = 0

    init(row: [String: Any]) { self.row = row }

    func send(url: String, method: String, body: Data?, bearer: String?) async throws
        -> SyncResponse
    {
        if method != "GET" { posts += 1 }
        let body: [String: Any] =
            method == "GET" ? ["revision": 1, "entries": [row]] : ["revision": 2, "accepted": 0]
        return SyncResponse(
            status: 200, body: (try? JSONSerialization.data(withJSONObject: body)) ?? Data())
    }
}

@MainActor
@Suite("Carnet altéré par le serveur")
struct SyncTamperTests {

    @Test("id-mismatch : toute la synchronisation échoue, rien n'est poussé")
    func idMismatchStopsTheWholeSync() async throws {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Resources/sync-row.json")
        let vector = try JSONDecoder().decode(TamperVector.self, from: Data(contentsOf: url))
        let mismatch = try #require(vector.rejected.first { $0.name == "id-mismatch" })
        let server = PullOnlyServer(row: [
            "entry_id": try #require(mismatch.row.entryId), "nonce": mismatch.row.nonce,
            "blob": mismatch.row.blob, "deleted": false,
        ])
        let credentials = SyncCredentials(
            endpoint: "https://example.test/api", accessToken: "access-1",
            refreshToken: "refresh-0", kdfSalt: vector.kdfSalt)

        await #expect(throws: SyncError.vaultTampered) {
            _ = try await Sync(transport: server)
                .sync(
                    Vault(entries: [VaultEntry(siteKey: "gitlab.com")]),
                    masterKey: vector.masterKey, credentials: credentials)
        }
        #expect(server.posts == 0)
    }

    @Test("Le message dit que rien n'a été écrit, en français comme en anglais")
    func messageSaysNothingWasWritten() {
        let message = SyncError.vaultTampered.message
        #expect(
            message
                == "Le carnet reçu du serveur a été modifié : synchronisation interrompue, "
                + "rien n'a été écrit."
                || message
                    == "The vault received from the server was tampered with: sync stopped, "
                    + "nothing was written.")
    }
}
