//
//  SyncInteropTests.swift
//  Interopérabilité du format de synchronisation (v2).
//
//  Le vecteur vient du CLI Python. Ce qui a déjà cassé deux fois n'est pas le
//  chiffrement mais le JSON autour : un champ inventé, un défaut ajouté, et la
//  fusion diverge d'un appareil à l'autre. La v2 ajoute le sel du compte et
//  les données associées : chaque cas de `rejected` doit échouer.
//

import CryptoKit
import Foundation
import Testing

@testable import TheCode

struct SyncRowFixture: Decodable {
    let entryId: String?
    let nonce: String
    let blob: String

    private enum CodingKeys: String, CodingKey {
        case entryId = "entry_id"
        case nonce, blob
    }
}

struct SyncRowVector: Decodable {
    let masterKey: String
    let kdfSalt: String
    let derivedSyncHex: String
    let entryAad: String
    let entry: VaultEntry
    let row: SyncRowFixture
    let settings: Settings
    let rejected: [Rejected]

    struct Settings: Decodable {
        let aad: String
        let value: SharedSettings
        let sealed: SyncRowFixture
    }

    struct Rejected: Decodable, CustomTestStringConvertible {
        let name: String
        let `as`: String
        let row: SyncRowFixture
        var testDescription: String { name }
    }
}

private func vector() throws -> SyncRowVector {
    let url = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .appendingPathComponent("Resources/sync-row.json")
    return try JSONDecoder().decode(SyncRowVector.self, from: Data(contentsOf: url))
}

/// Une seule dérivation pour toute la suite : 600 000 itérations coûtent.
private let sharedKey: SymmetricKey = {
    let v = try! vector()
    return try! Sync.deriveKey(masterKey: v.masterKey, kdfSalt: Base64URL.decode(v.kdfSalt)!)
}()

private func hex(_ key: SymmetricKey) -> String {
    key.withUnsafeBytes { $0.map { String(format: "%02x", $0) }.joined() }
}

private func data(_ value: String) throws -> Data {
    try #require(Base64URL.decode(value))
}

@Suite("Interopérabilité de la synchronisation")
struct SyncInteropTests {

    @Test("La clef dérivée est celle des autres implémentations")
    func derivesTheSameKey() throws {
        let vector = try vector()
        #expect(try data(vector.kdfSalt).count == Sync.kdfSaltBytes)
        #expect(hex(sharedKey) == vector.derivedSyncHex)
        #expect(Sync.entryAAD(vector.entry.id) == Data(vector.entryAad.utf8))
        #expect(Sync.settingsAAD == Data(vector.settings.aad.utf8))
    }

    @Test("Déchiffre une ligne produite par une autre implémentation")
    func decryptsAForeignRow() throws {
        let vector = try vector()
        let entry = try Sync.openEntry(
            entryId: try #require(vector.row.entryId), nonce: data(vector.row.nonce),
            blob: data(vector.row.blob), key: sharedKey)

        #expect(entry == vector.entry)
        #expect(entry.id == vector.row.entryId)
        #expect(entry.domains == ["google.com", "google.fr"])
        #expect(entry.charset.symbols == false)
        // Absent du JSON : inventer une valeur ferait diverger la fusion.
        #expect(entry.deleted == nil)
    }

    @Test("Ouvre les réglages produits par une autre implémentation")
    func opensForeignSettings() throws {
        let vector = try vector()
        let settings = Sync.openSettings(
            nonce: try data(vector.settings.sealed.nonce),
            blob: try data(vector.settings.sealed.blob), key: sharedKey)
        #expect(settings == vector.settings.value)
    }

    @Test("Rechiffre vers quelque chose que les autres relisent")
    func reEncryptsFaithfully() throws {
        // Le nonce change à chaque chiffrement : on ne peut pas comparer les
        // octets, seulement vérifier que le tour complet rend la même entrée.
        let vector = try vector()
        let sealed = try Sync.sealEntry(vector.entry, key: sharedKey)
        let again = try Sync.openEntry(
            entryId: vector.entry.id, nonce: sealed.nonce, blob: sealed.blob, key: sharedKey)
        #expect(again == vector.entry)

        let settings = try Sync.sealSettings(vector.settings.value, key: sharedKey)
        #expect(
            Sync.openSettings(nonce: settings.nonce, blob: settings.blob, key: sharedKey)
                == vector.settings.value)
    }

    @Test("Chaque ligne du vecteur « rejected » est refusée", arguments: try vector().rejected)
    func rejects(_ rejected: SyncRowVector.Rejected) throws {
        let nonce = try data(rejected.row.nonce)
        let blob = try data(rejected.row.blob)

        switch rejected.as {
        case "entry":
            #expect(throws: Sync.EntryError.self) {
                _ = try Sync.openEntry(
                    entryId: try #require(rejected.row.entryId), nonce: nonce, blob: blob,
                    key: sharedKey)
            }
        case "settings":
            #expect(Sync.openSettings(nonce: nonce, blob: blob, key: sharedKey) == nil)
        default:
            Issue.record("cas inconnu : \(rejected.as)")
        }
    }

    @Test("L'identifiant qui ne correspond pas à la ligne est rejeté après déchiffrement")
    func rejectsAnIdMismatch() throws {
        let vector = try vector()
        let mismatch = try #require(vector.rejected.first { $0.name == "id-mismatch" })
        #expect(throws: Sync.EntryError.idMismatch) {
            _ = try Sync.openEntry(
                entryId: try #require(mismatch.row.entryId), nonce: data(mismatch.row.nonce),
                blob: data(mismatch.row.blob), key: sharedKey)
        }
    }
}
