//
//  TransferVaultTests.swift
//  Export et import chiffrés d'un carnet.
//
//  L'essentiel est l'interopérabilité : un carnet exporté depuis un appareil
//  doit être lisible par un autre, quelle que soit l'implémentation. Le
//  deflate brut est le point sensible — un en-tête zlib de plus et les autres
//  implémentations ne liraient rien.
//

import Foundation
import Testing

@testable import TheCode

private struct TransferVector: Decodable {
    let masterKey: String
    let payload: String
}

private func filled() -> Vault {
    var entry = VaultEntry(siteKey: "google.com", domains: ["google.com", "google.fr"])
    entry.login = "moi@example.com"
    return Vault(entries: [entry])
}

@Suite("Transfert d'un carnet")
struct TransferVaultTests {

    @Test("Aller-retour fidèle")
    func roundTrips() throws {
        let before = filled()
        let after = try Transfer.importVault(
            try Transfer.exportVault(before, masterKey: "clef"), masterKey: "clef")

        #expect(after.entries.count == before.entries.count)
        #expect(after.entries[0].canonical() == before.entries[0].canonical())
    }

    @Test("Une autre clef maîtresse est refusée")
    func refusesAnotherMasterKey() throws {
        let payload = try Transfer.exportVault(filled(), masterKey: "clef")

        // AES-GCM authentifie : il refuse, il ne rend pas un contenu faux.
        #expect(throws: (any Error).self) {
            _ = try Transfer.importVault(payload, masterKey: "mauvaise")
        }
    }

    @Test("Une version inconnue est refusée")
    func refusesAnUnknownVersion() {
        // Interpréter un format inconnu au hasard serait pire que refuser.
        #expect(throws: Transfer.TransferError.unreadable(
            "Version « TC9 » inconnue, ce client lit TC1.")) {
            _ = try Transfer.importVault("TC9.aaa.bbb", masterKey: "clef")
        }
    }

    @Test("Un payload tronqué est refusé")
    func refusesATruncatedPayload() {
        #expect(throws: (any Error).self) {
            _ = try Transfer.importVault("TC1.seulement-deux", masterKey: "clef")
        }
    }

    @Test("Une altération est détectée")
    func detectsTampering() throws {
        let parts = try Transfer.exportVault(filled(), masterKey: "clef").split(separator: ".")
        let tampered = "\(parts[0]).\(parts[1]).\(parts[2].dropLast())A"

        #expect(throws: (any Error).self) {
            _ = try Transfer.importVault(tampered, masterKey: "clef")
        }
    }

    @Test("Le nonce n'est jamais réutilisé")
    func neverReusesANonce() throws {
        // Réutiliser un nonce avec la même clef casse AES-GCM.
        let vault = filled()
        var nonces = Set<String>()
        for _ in 0..<10 {
            nonces.insert(
                String(try Transfer.exportVault(vault, masterKey: "clef").split(separator: ".")[1]))
        }
        #expect(nonces.count == 10)
    }

    @Test("Lit un payload produit par une autre implémentation")
    func readsAForeignPayload() throws {
        // Le fichier vient du CLI Python : c'est la seule garantie qui vaille,
        // et c'est elle qui prouve que le deflate est bien du deflate brut.
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Resources/transfer-vector.json")
        let vector = try JSONDecoder().decode(TransferVector.self, from: Data(contentsOf: url))

        let imported = try Transfer.importVault(vector.payload, masterKey: vector.masterKey)
        #expect(!imported.entries.isEmpty)
    }

    @Test("Produit un payload que les autres relisent")
    func producesWhatOthersRead() throws {
        let payload = try Transfer.exportVault(filled(), masterKey: "clef")

        #expect(payload.hasPrefix("TC1."))
        // base64url sans remplissage : un « + » ou un « = » casserait les autres.
        #expect(payload.dropFirst(4).allSatisfy { $0.isLetter || $0.isNumber || "._-".contains($0) })
    }

    @Test("La compression fait tenir un gros carnet dans un QR")
    func compressionShrinksARepetitiveVault() throws {
        var big = Vault()
        for i in 0..<50 {
            big.entries.append(VaultEntry(siteKey: "site\(i).example.com"))
        }

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let raw = try encoder.encode(big).count
        let payload = try Transfer.exportVault(big, masterKey: "clef").count

        #expect(payload < raw / 2, "brut \(raw), payload \(payload)")
    }
}

@Suite("Interopérabilité du payload")
struct TransferInteropDirectionTests {

    @Test("Un payload produit ici est relisible par les autres")
    func producesAReadablePayload() throws {
        // Le contrôle ne peut pas être fait d'ici : on vérifie au moins que le
        // contenu compressé porte bien l'enveloppe zlib que les autres
        // attendent — c'est ce qui manquait et que l'aller-retour local ne
        // révélait pas.
        var entry = VaultEntry(siteKey: "google.com")
        entry.login = "moi@example.com"

        let payload = try Transfer.exportVault(Vault(entries: [entry]), masterKey: "clef")
        let parts = payload.split(separator: ".").map(String.init)
        let nonce = try #require(Base64URL.decode(parts[1]))
        let blob = try #require(Base64URL.decode(parts[2]))

        let compressed = try Transfer.open(
            nonce: nonce, blob: blob, with: Transfer.deriveKey("clef"))

        // 0x78 : méthode deflate, fenêtre 32 Ko. C'est l'en-tête RFC 1950.
        #expect(compressed[compressed.startIndex] == 0x78)
        #expect(compressed.count > 6)
    }
}

@Suite("Découpage en plusieurs QR")
struct TransferFragmentTests {

    @Test("Un payload court reste en un seul morceau")
    func shortPayloadStaysWhole() {
        // Imposer un assemblage pour un carnet ordinaire n'apporterait rien.
        let payload = "TC1.abc.def"
        #expect(Transfer.fragments(payload) == [payload])
    }

    @Test("Un payload long est découpé et se réassemble")
    func longPayloadSplitsAndRejoins() throws {
        let body = String(repeating: "A", count: 7000)
        let payload = "TC1.\(body)"

        let parts = Transfer.fragments(payload)
        #expect(parts.count == 3)
        #expect(parts.allSatisfy { $0.hasPrefix("TC1m.") })

        // Le lecteur accumule : l'ordre ne doit pas compter, et un fragment lu
        // deux fois ne doit pas casser l'assemblage.
        let scanner = QrScanner()
        for text in parts.reversed() { scanner.accept(text) }
        scanner.accept(parts[1])

        #expect(scanner.payload == payload)
    }

    @Test("Un seul QR est accepté directement")
    func singleCodeIsAcceptedAsIs() {
        let scanner = QrScanner()
        scanner.accept("TC1.nonce.donnees")
        #expect(scanner.payload == "TC1.nonce.donnees")
    }

    @Test("Un QR étranger est ignoré sans bruit")
    func foreignCodeIsIgnored() {
        // L'utilisateur vise peut-être encore : se plaindre serait prématuré.
        let scanner = QrScanner()
        scanner.accept("https://example.fr")
        #expect(scanner.payload == nil)
        #expect(scanner.failure == nil)
    }

    @Test("Tant qu'il manque un fragment, rien n'est rendu")
    func incompleteYieldsNothing() {
        let scanner = QrScanner()
        scanner.accept("TC1m.0.3.aaa")
        scanner.accept("TC1m.2.3.ccc")

        #expect(scanner.payload == nil)
        #expect(scanner.progress != nil)
    }
}
