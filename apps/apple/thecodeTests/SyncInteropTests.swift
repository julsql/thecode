//
//  SyncInteropTests.swift
//  Interopérabilité du format de synchronisation.
//
//  Le vecteur vient du CLI Python. Ce qui a déjà cassé deux fois n'est pas le
//  chiffrement mais le JSON autour : un champ inventé, un défaut ajouté, et la
//  fusion diverge d'un appareil à l'autre.
//

import Foundation
import Testing

@testable import TheCode

private struct SyncVector: Decodable {
    let masterKey: String
    let entry: VaultEntry
    let row: Row

    struct Row: Decodable {
        let entryId: String
        let nonce: String
        let blob: String
        let deleted: Bool

        private enum CodingKeys: String, CodingKey {
            case entryId = "entry_id"
            case nonce, blob, deleted
        }
    }
}

@Suite("Interopérabilité de la synchronisation")
struct SyncInteropTests {

    private func vector() throws -> SyncVector {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Resources/sync-row.json")
        return try JSONDecoder().decode(SyncVector.self, from: Data(contentsOf: url))
    }

    @Test("Déchiffre une ligne produite par une autre implémentation")
    func decryptsAForeignRow() throws {
        let vector = try vector()
        let key = try Transfer.deriveKey(vector.masterKey)

        let nonce = try #require(Base64URL.decode(vector.row.nonce))
        let blob = try #require(Base64URL.decode(vector.row.blob))
        let plain = try Transfer.open(nonce: nonce, blob: blob, with: key)
        let entry = try JSONDecoder().decode(VaultEntry.self, from: plain)

        #expect(entry == vector.entry)
        #expect(entry.id == vector.row.entryId)
        #expect(entry.domains == ["google.com", "google.fr"])
        #expect(entry.charset.symbols == false)
        // Absent du JSON : inventer une valeur ferait diverger la fusion.
        #expect(entry.deleted == nil)
    }

    @Test("Rechiffre vers quelque chose que les autres relisent")
    func reEncryptsFaithfully() throws {
        // Le nonce change à chaque chiffrement : on ne peut pas comparer les
        // octets, seulement vérifier que le tour complet rend la même entrée.
        let vector = try vector()
        let key = try Transfer.deriveKey(vector.masterKey)

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let sealed = try Transfer.seal(try encoder.encode(vector.entry), with: key)
        let again = try JSONDecoder().decode(
            VaultEntry.self,
            from: try Transfer.open(nonce: sealed.nonce, blob: sealed.blob, with: key))

        #expect(again == vector.entry)
    }
}
