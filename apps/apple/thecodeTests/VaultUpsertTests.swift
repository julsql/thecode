//
//  VaultUpsertTests.swift
//  Enregistrer les réglages d'un site.
//
//  Le piège est le siteKey : il produit le mot de passe, le réécrire changerait
//  un mot de passe déjà en service.
//

import Foundation
import Testing

@testable import TheCode

@Suite("Enregistrement au carnet")
struct VaultUpsertTests {

    private let full = Charset(lower: true, upper: true, symbols: true, numbers: true)

    @Test("Un site inconnu crée une entrée")
    func createsForANewSite() {
        var vault = Vault()
        let entry = vault.upsert(
            site: "google.com", length: 24,
            charset: Charset(lower: true, upper: true, symbols: false, numbers: true))

        #expect(vault.entries.count == 1)
        #expect(entry.siteKey == "google.com")
        #expect(entry.length == 24)
        #expect(entry.charset.symbols == false)
    }

    @Test("Un site connu voit ses réglages mis à jour, jamais son siteKey")
    func updatesSettingsOnly() {
        var vault = Vault()
        let created = vault.upsert(site: "google.com", length: 20, charset: full)

        let updated = vault.upsert(
            site: "google.com", length: 32,
            charset: Charset(lower: true, upper: false, symbols: false, numbers: true))

        #expect(vault.entries.count == 1)
        #expect(updated.siteKey == created.siteKey)
        #expect(updated.length == 32)
        #expect(updated.charset.upper == false)
    }

    @Test("N'importe lequel des domaines retrouve l'entrée")
    func findsByAnyDomain() {
        // Sans cela « google.fr » créerait un doublon d'une entrée qui le
        // couvre déjà, avec un mot de passe différent.
        var vault = Vault(entries: [
            VaultEntry(siteKey: "google.com", domains: ["google.com", "google.fr"])
        ])

        let found = vault.upsert(site: "google.fr", length: 28, charset: full)

        #expect(vault.entries.count == 1)
        #expect(found.siteKey == "google.com")
        #expect(found.length == 28)
    }

    @Test("Une entrée supprimée n'est pas ressuscitée")
    func startsAfreshAfterADeletion() {
        var vault = Vault()
        let first = vault.upsert(site: "google.com", length: 20, charset: full)
        vault.entries[0].deleted = true

        // Sa pierre tombale doit se propager : on en crée une nouvelle, avec
        // son propre identifiant.
        let again = vault.upsert(site: "google.com", length: 20, charset: full)
        #expect(again.id != first.id)
        #expect(vault.entries.count == 2)
    }

    @Test("La mise à jour réhorodate l'entrée")
    func stampsTheEntry() async throws {
        var vault = Vault()
        let before = vault.upsert(site: "google.com", length: 20, charset: full).updatedAt

        try await Task.sleep(nanoseconds: 1_100_000_000)
        let after = vault.upsert(site: "google.com", length: 24, charset: full).updatedAt

        // L'horodatage départage les carnets à la fusion : sans mise à jour,
        // l'autre appareil gagnerait et les réglages seraient perdus.
        #expect(after > before)
    }
}
