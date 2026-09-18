//
//  VaultStoreTests.swift
//  Persistance du carnet.
//
//  L'écriture doit être atomique et le chargement tolérant : un fichier
//  corrompu ne doit pas bloquer l'app sur un écran d'échec.
//

import Foundation
import Testing

@testable import TheCode

@Suite("Stockage du carnet")
struct VaultStoreTests {

    private func temporaryURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("vault-\(UUID().uuidString).json")
    }

    @Test("Aller-retour fidèle")
    func roundTrips() throws {
        let url = temporaryURL()
        defer { try? FileManager.default.removeItem(at: url) }

        var entry = VaultEntry(siteKey: "google.com", domains: ["google.com", "google.fr"])
        entry.login = "moi@example.fr"
        entry.counter = 3
        try VaultStore.save(Vault(entries: [entry]), to: url)

        let loaded = VaultStore.load(from: url)
        #expect(loaded.entries.count == 1)
        #expect(loaded.entries[0].domains == ["google.com", "google.fr"])
        #expect(loaded.entries[0].counter == 3)
        #expect(loaded.entries[0].login == "moi@example.fr")
    }

    @Test("Un fichier absent rend un carnet vide")
    func missingFileIsEmpty() {
        #expect(VaultStore.load(from: temporaryURL()).entries.isEmpty)
    }

    @Test("Un fichier illisible rend un carnet vide plutôt qu'une erreur")
    func corruptFileIsEmpty() throws {
        let url = temporaryURL()
        defer { try? FileManager.default.removeItem(at: url) }
        try Data("pas du JSON".utf8).write(to: url)

        // Remonter une erreur bloquerait l'app sans que l'utilisatrice puisse
        // rien y faire ; la synchronisation récupérera ce qui existe ailleurs.
        #expect(VaultStore.load(from: url).entries.isEmpty)
    }

    @Test("La sauvegarde horodate le carnet")
    func saveStamps() throws {
        let url = temporaryURL()
        defer { try? FileManager.default.removeItem(at: url) }

        var vault = Vault(entries: [VaultEntry(siteKey: "google.com")])
        vault.updatedAt = "1970-01-01T00:00:00Z"
        try VaultStore.save(vault, to: url)

        // L'horodatage départage les carnets à la fusion : le laisser au passé
        // ferait perdre les écritures locales.
        #expect(VaultStore.load(from: url).updatedAt != "1970-01-01T00:00:00Z")
    }

    @Test("Sans conteneur de groupe d'app, l'échec est explicite")
    func failsWithoutContainer() {
        #expect(throws: VaultStore.VaultStoreError.containerUnavailable) {
            try VaultStore.save(Vault(), to: nil)
        }
    }
}
