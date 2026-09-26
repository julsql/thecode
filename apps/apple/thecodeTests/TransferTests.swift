//
//  TransferTests.swift
//  Chiffrement du carnet avant transfert.
//
//  L'essentiel est l'interopérabilité : un carnet chiffré sur un appareil doit
//  être lisible sur tous les autres.
//

import CryptoKit
import Foundation
import Testing

@testable import TheCode

struct TransferVectorFixture: Decodable {
    let masterKey: String
    let derivedTransferHex: String
    let aad: String
    let vault: Vault
    let payload: String
    let rejected: [Rejected]

    struct Rejected: Decodable, CustomTestStringConvertible {
        let name: String
        let payload: String
        var testDescription: String { name }
    }
}

func loadTransferVector() throws -> TransferVectorFixture {
    let url = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .appendingPathComponent("Resources/transfer-vector.json")
    return try JSONDecoder().decode(TransferVectorFixture.self, from: Data(contentsOf: url))
}

private func base64url(_ value: String) -> Data {
    var s = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
    s += String(repeating: "=", count: (4 - s.count % 4) % 4)
    return Data(base64Encoded: s) ?? Data()
}

private let salt = Data(repeating: 7, count: 16)
private let key = try! Transfer.deriveKey("clef", salt: salt)

@Suite("Transfert chiffré")
struct TransferTests {

    @Test("Aller-retour fidèle")
    func roundTrips() throws {
        let plain = Data("{\"site\":\"google.com\"}".utf8)
        let sealed = try Transfer.seal(plain, with: key, aad: Transfer.aad)
        #expect(
            try Transfer.open(nonce: sealed.nonce, blob: sealed.blob, with: key, aad: Transfer.aad)
                == plain)
    }

    @Test("Une mauvaise clef ne peut pas ouvrir")
    func wrongKeyFails() throws {
        let sealed = try Transfer.seal(Data("secret".utf8), with: key, aad: Transfer.aad)
        let other = try Transfer.deriveKey("mauvaise", salt: salt)

        // AES-GCM authentifie : il refuse, il ne rend pas du contenu faux.
        #expect(throws: Transfer.TransferError.cannotOpen) {
            _ = try Transfer.open(
                nonce: sealed.nonce, blob: sealed.blob, with: other, aad: Transfer.aad)
        }
    }

    @Test("D'autres données associées ne peuvent pas ouvrir")
    func otherAadFails() throws {
        let sealed = try Transfer.seal(Data("secret".utf8), with: key, aad: Transfer.aad)
        #expect(throws: Transfer.TransferError.cannotOpen) {
            _ = try Transfer.open(
                nonce: sealed.nonce, blob: sealed.blob, with: key, aad: Sync.settingsAAD)
        }
    }

    @Test("Un autre sel donne une autre clef")
    func saltChangesTheKey() throws {
        let other = try Transfer.deriveKey("clef", salt: Data(repeating: 8, count: 16))
        let bytes = { (k: SymmetricKey) in k.withUnsafeBytes { Data($0) } }
        #expect(bytes(other) != bytes(key))
    }

    @Test("Une altération est détectée")
    func tamperingIsDetected() throws {
        var sealed = try Transfer.seal(Data("secret".utf8), with: key, aad: Transfer.aad)
        var blob = sealed.blob
        blob[blob.startIndex] ^= 0x01
        sealed = Transfer.Sealed(nonce: sealed.nonce, blob: blob)

        #expect(throws: Transfer.TransferError.cannotOpen) {
            _ = try Transfer.open(
                nonce: sealed.nonce, blob: sealed.blob, with: key, aad: Transfer.aad)
        }
    }

    @Test("Le nonce n'est jamais réutilisé")
    func nonceIsNeverReused() throws {
        // Réutiliser un nonce avec la même clef casse AES-GCM.
        var nonces = Set<Data>()
        for _ in 0..<20 {
            nonces.insert(try Transfer.seal(Data("x".utf8), with: key, aad: Transfer.aad).nonce)
        }
        #expect(nonces.count == 20)
    }

    @Test("Dérive la même clef et déchiffre un payload d'une autre implémentation")
    func decryptsSharedVector() throws {
        let vector = try loadTransferVector()
        let parts = vector.payload.split(separator: ".").map(String.init)
        #expect(parts.count == 4)
        #expect(parts[0] == "TC2")
        #expect(Transfer.aad == Data(vector.aad.utf8))

        let salt = base64url(parts[1])
        #expect(salt.count == 16)
        let key = try Transfer.deriveKey(vector.masterKey, salt: salt)
        let hex = key.withUnsafeBytes { $0.map { String(format: "%02x", $0) }.joined() }
        #expect(hex == vector.derivedTransferHex)

        let compressed = try Transfer.open(
            nonce: base64url(parts[2]), blob: base64url(parts[3]), with: key, aad: Transfer.aad)
        // zlib RFC 1950 : en-tête 0x78.
        #expect(compressed.first == 0x78)
    }
}
