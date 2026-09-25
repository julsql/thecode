//
//  VaultEntryManagementTests.swift
//  Gestion du carnet derrière le verrou : suppression et détail d'une entrée.
//

import Foundation
import Testing

@testable import TheCode

@Suite("Gestion du carnet")
struct VaultEntryManagementTests {

    @Test("Supprimer pose une pierre tombale réhorodatée, sans retirer l'entrée")
    func deleteIsTombstone() {
        var entry = VaultEntry(siteKey: "example.com")
        entry.updatedAt = "2026-01-01T00:00:00Z"
        var vault = Vault(entries: [entry, VaultEntry(siteKey: "autre.example")])

        let deleted = vault.delete(id: entry.id, at: "2026-09-25T10:00:00Z")
        #expect(deleted)
        #expect(vault.entries.count == 2)
        #expect(vault.entries[0].deleted == true)
        #expect(vault.entries[0].updatedAt == "2026-09-25T10:00:00Z")
        #expect(vault.entries[1].deleted == nil)
        #expect(VaultView(vault: vault).visibleEntries.map(\.siteKey) == ["autre.example"])
    }

    @Test("Supprimer une entrée inconnue ou déjà supprimée ne touche à rien")
    func deleteUnknownOrDeleted() {
        var entry = VaultEntry(siteKey: "example.com")
        entry.deleted = true
        entry.updatedAt = "2026-01-01T00:00:00Z"
        var vault = Vault(entries: [entry])

        let unknown = vault.delete(id: "inconnue")
        let again = vault.delete(id: entry.id)
        #expect(!unknown)
        #expect(!again)
        #expect(vault.entries[0].updatedAt == "2026-01-01T00:00:00Z")
    }

    @Test("La suppression l'emporte à la fusion avec l'autre carnet")
    func deletePropagatesThroughMerge() {
        var entry = VaultEntry(siteKey: "example.com")
        entry.updatedAt = "2026-01-01T00:00:00Z"
        let other = Vault(entries: [entry])
        var local = Vault(entries: [entry])
        local.delete(id: entry.id, at: "2026-09-25T10:00:00Z")

        let (merged, _) = Vault.merge(other, local)
        #expect(merged.entries.first?.deleted == true)
    }

    @Test("Libellé affiché : le label, sinon la siteKey")
    func label() {
        var entry = VaultEntry(siteKey: "example.com")
        #expect(VaultEntryDetailView.label(of: entry) == "example.com")
        entry.label = "Mon compte"
        #expect(VaultEntryDetailView.label(of: entry) == "Mon compte")
        entry.label = ""
        #expect(VaultEntryDetailView.label(of: entry) == "example.com")
    }

    @Test("Résumé des jeux de caractères")
    func charsetSummary() {
        #expect(
            VaultEntryDetailView.charsetSummary(
                Charset(lower: true, upper: false, symbols: false, numbers: true))
                == "a–z, 0–9")
        #expect(
            VaultEntryDetailView.charsetSummary(
                Charset(lower: false, upper: false, symbols: false, numbers: false)) == "—")
    }

    @Test("Date de mise à jour lisible, valeur brute si illisible")
    func formattedDate() {
        let formatted = VaultEntryDetailView.formattedDate(
            "2026-09-25T10:00:00Z", locale: Locale(identifier: "en_US_POSIX"))
        #expect(formatted != "2026-09-25T10:00:00Z")
        #expect(formatted.contains("2026"))
        #expect(VaultEntryDetailView.formattedDate("pas une date") == "pas une date")
    }
}
