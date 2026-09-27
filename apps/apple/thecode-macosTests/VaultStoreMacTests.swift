//
//  VaultStoreMacTests.swift
//  Écriture du carnet sur macOS.
//
//  La protection des données (.completeFileProtection) échoue sur macOS avec
//  EPERM : le carnet ne s'enregistrait pas. Côté iOS, VaultStoreTests couvre
//  le reste.
//

import Foundation
import Testing

@testable import TheCode_for_Mac

@Suite("Stockage du carnet (macOS)")
struct VaultStoreMacTests {

    @Test("Le carnet s'enregistre et se relit")
    func savesAndLoads() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("vault-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }

        var entry = VaultEntry(siteKey: "github.com", domains: ["github.com"])
        entry.login = "demo@example.com"
        try VaultStore.save(Vault(entries: [entry]), to: url)

        let loaded = VaultStore.load(from: url)
        #expect(loaded.entries.map(\.login) == ["demo@example.com"])
    }
}
