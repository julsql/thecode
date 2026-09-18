//
//  TransferTests.swift
//  Chiffrement du carnet avant transfert.
//
//  L'essentiel est l'interopérabilité : un carnet chiffré sur un appareil doit
//  être lisible sur tous les autres.
//

import Foundation
import Testing

@testable import TheCode

private struct TransferVector: Decodable {
    let masterKey: String
    let payload: String
}

private func loadVector() throws -> TransferVector {
    let url = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .appendingPathComponent("Resources/transfer-vector.json")
    return try JSONDecoder().decode(TransferVector.self, from: Data(contentsOf: url))
}

private func base64url(_ value: String) -> Data {
    var s = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
    s += String(repeating: "=", count: (4 - s.count % 4) % 4)
    return Data(base64Encoded: s) ?? Data()
}

@Suite("Transfert chiffré")
struct TransferTests {

    @Test("Aller-retour fidèle")
    func roundTrips() throws {
        let key = try Transfer.deriveKey("clef")
        let plain = Data("{\"site\":\"google.com\"}".utf8)
        let sealed = try Transfer.seal(plain, with: key)
        #expect(try Transfer.open(nonce: sealed.nonce, blob: sealed.blob, with: key) == plain)
    }

    @Test("Une mauvaise clef ne peut pas ouvrir")
    func wrongKeyFails() throws {
        let sealed = try Transfer.seal(Data("secret".utf8), with: Transfer.deriveKey("clef"))
        let other = try Transfer.deriveKey("mauvaise")

        // AES-GCM authentifie : il refuse, il ne rend pas du contenu faux.
        #expect(throws: Transfer.TransferError.cannotOpen) {
            _ = try Transfer.open(nonce: sealed.nonce, blob: sealed.blob, with: other)
        }
    }

    @Test("Une altération est détectée")
    func tamperingIsDetected() throws {
        let key = try Transfer.deriveKey("clef")
        var sealed = try Transfer.seal(Data("secret".utf8), with: key)
        var blob = sealed.blob
        blob[blob.startIndex] ^= 0x01
        sealed = Transfer.Sealed(nonce: sealed.nonce, blob: blob)

        #expect(throws: Transfer.TransferError.cannotOpen) {
            _ = try Transfer.open(nonce: sealed.nonce, blob: sealed.blob, with: key)
        }
    }

    @Test("Le nonce n'est jamais réutilisé")
    func nonceIsNeverReused() throws {
        // Réutiliser un nonce avec la même clef casse AES-GCM.
        let key = try Transfer.deriveKey("clef")
        var nonces = Set<Data>()
        for _ in 0..<20 {
            nonces.insert(try Transfer.seal(Data("x".utf8), with: key).nonce)
        }
        #expect(nonces.count == 20)
    }

    @Test("Déchiffre un payload produit par une autre implémentation")
    func decryptsSharedVector() throws {
        let vector = try loadVector()
        let parts = vector.payload.split(separator: ".").map(String.init)
        #expect(parts[0] == "TC1")

        let key = try Transfer.deriveKey(vector.masterKey)
        let compressed = try Transfer.open(
            nonce: base64url(parts[1]), blob: base64url(parts[2]), with: key)

        // Le payload partagé est compressé : on vérifie que le déchiffrement
        // aboutit, la décompression étant couverte ailleurs.
        #expect(!compressed.isEmpty)
    }
}
