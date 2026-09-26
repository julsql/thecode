//
//  VaultViewTests.swift
//  Écran du carnet : ce qu'il montre, et surtout ce qu'il ne montre pas.
//

import SwiftUI
import Testing

@testable import TheCode

@Suite("Écran du carnet")
struct VaultViewTests {

    @Test("Les entrées supprimées ne sont pas affichées")
    func deletedEntriesAreHidden() {
        var removed = VaultEntry(siteKey: "ancien.example")
        removed.deleted = true

        let vault = Vault(entries: [VaultEntry(siteKey: "google.com"), removed])
        let view = VaultView(vault: vault)

        // Les pierres tombales servent à propager la suppression lors de la
        // synchronisation ; elles n'ont rien à faire à l'écran.
        #expect(view.visibleEntries.count == 1)
        #expect(view.visibleEntries.first?.siteKey == "google.com")
    }

    @Test("Les entrées sont triées par nom")
    func entriesAreSorted() {
        let vault = Vault(entries: [
            VaultEntry(siteKey: "zeta.example"),
            VaultEntry(siteKey: "alpha.example"),
        ])
        #expect(
            VaultView(vault: vault).visibleEntries.map(\.siteKey)
                == ["alpha.example", "zeta.example"]
        )
    }

    @Test("Un carnet vide reste vide")
    func emptyVaultStaysEmpty() {
        #expect(VaultView(vault: Vault()).visibleEntries.isEmpty)
    }

    @Test("La section de tête ne change rien aux entrées affichées")
    func headerKeepsEntries() {
        var removed = VaultEntry(siteKey: "ancien.example")
        removed.deleted = true
        let vault = Vault(entries: [
            VaultEntry(siteKey: "zeta.example"), removed, VaultEntry(siteKey: "alpha.example"),
        ])

        // La synchronisation vit en tête de liste : elle ne doit ni filtrer
        // ni réordonner le carnet.
        let view = VaultView(vault: vault) { Text("Synchronisation") }
        #expect(view.visibleEntries.map(\.siteKey) == ["alpha.example", "zeta.example"])
    }
}
