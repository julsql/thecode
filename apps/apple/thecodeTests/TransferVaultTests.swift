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
            "Version « TC9 » inconnue, ce client lit TC2.")) {
            _ = try Transfer.importVault("TC9.aaa.bbb.ccc", masterKey: "clef")
        }
    }

    @Test("Le format v1 n'est plus lu")
    func refusesTC1() {
        #expect(throws: Transfer.TransferError.unreadable(
            "Version « TC1 » inconnue, ce client lit TC2.")) {
            _ = try Transfer.importVault("TC1.nonce.donnees", masterKey: "clef")
        }
    }

    @Test("Un payload tronqué est refusé")
    func refusesATruncatedPayload() {
        #expect(throws: (any Error).self) {
            _ = try Transfer.importVault("TC2.seulement-deux", masterKey: "clef")
        }
    }

    @Test("Un sel ou un nonce de mauvaise taille est refusé avant tout déchiffrement")
    func refusesBadSaltOrNonceLength() throws {
        let parts = try Transfer.exportVault(filled(), masterKey: "clef").split(separator: ".")
        let shortSalt = "TC2.\(Base64URL.encode(Data(count: 15))).\(parts[2]).\(parts[3])"
        let shortNonce = "TC2.\(parts[1]).\(Base64URL.encode(Data(count: 11))).\(parts[3])"
        for payload in [shortSalt, shortNonce] {
            #expect(throws: Transfer.TransferError.unreadable("Encodage invalide.")) {
                _ = try Transfer.importVault(payload, masterKey: "clef")
            }
        }
    }

    @Test("Chaque export tire un sel neuf")
    func neverReusesASalt() throws {
        let vault = filled()
        var salts = Set<String>()
        for _ in 0..<5 {
            salts.insert(
                String(try Transfer.exportVault(vault, masterKey: "clef").split(separator: ".")[1]))
        }
        #expect(salts.count == 5)
    }

    @Test("Une altération est détectée")
    func detectsTampering() throws {
        let parts = try Transfer.exportVault(filled(), masterKey: "clef").split(separator: ".")
        // Quatre caractères, pas un seul : en base64url le dernier caractère
        // ne porte parfois que des bits ignorés au décodage — « Aw » et « Ax »
        // donnent le même octet. Changer ce seul caractère laissait le chiffré
        // intact, l'import réussissait, et le test échouait sans que rien
        // n'ait été altéré.
        let cipher = parts[3]
        let tail = cipher.hasSuffix("AAAA") ? "BBBB" : "AAAA"
        let tampered = "\(parts[0]).\(parts[1]).\(parts[2]).\(cipher.dropLast(4))\(tail)"

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
                String(try Transfer.exportVault(vault, masterKey: "clef").split(separator: ".")[2]))
        }
        #expect(nonces.count == 10)
    }

    @Test("Lit un payload produit par une autre implémentation")
    func readsAForeignPayload() throws {
        // Le fichier vient du CLI Python : c'est la seule garantie qui vaille,
        // et c'est elle qui prouve que l'enveloppe zlib est la bonne.
        let vector = try loadTransferVector()

        let imported = try Transfer.importVault(vector.payload, masterKey: vector.masterKey)
        #expect(imported.entries == vector.vault.entries)
        #expect(imported.updatedAt == vector.vault.updatedAt)
    }

    @Test(
        "Refuse chaque payload du vecteur « rejected »",
        arguments: try loadTransferVector().rejected)
    func refusesRejected(_ rejected: TransferVectorFixture.Rejected) throws {
        let vector = try loadTransferVector()
        #expect(throws: (any Error).self) {
            _ = try Transfer.importVault(rejected.payload, masterKey: vector.masterKey)
        }
    }

    @Test("Produit un payload que les autres relisent")
    func producesWhatOthersRead() throws {
        let payload = try Transfer.exportVault(filled(), masterKey: "clef")

        #expect(payload.hasPrefix("TC2."))
        #expect(payload.split(separator: ".").count == 4)
        #expect(Base64URL.decode(String(payload.split(separator: ".")[1]))?.count == 16)
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
        let salt = try #require(Base64URL.decode(parts[1]))
        let nonce = try #require(Base64URL.decode(parts[2]))
        let blob = try #require(Base64URL.decode(parts[3]))

        let compressed = try Transfer.open(
            nonce: nonce, blob: blob, with: Transfer.deriveKey("clef", salt: salt),
            aad: Transfer.aad)

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
        let payload = "TC2.sel.abc.def"
        #expect(Transfer.fragments(payload) == [payload])
    }

    @Test("Un payload long est découpé et se réassemble")
    func longPayloadSplitsAndRejoins() throws {
        let body = String(repeating: "A", count: 7000)
        let payload = "TC2.\(body)"

        let parts = Transfer.fragments(payload)
        #expect(parts.count == 3)
        #expect(parts.allSatisfy { $0.hasPrefix("TC2m.") })

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
        scanner.accept("TC2.sel.nonce.donnees")
        #expect(scanner.payload == "TC2.sel.nonce.donnees")
    }

    @Test("Un QR étranger est ignoré sans bruit")
    func foreignCodeIsIgnored() {
        // L'utilisateur vise peut-être encore : se plaindre serait prématuré.
        let scanner = QrScanner()
        scanner.accept("https://example.fr")
        #expect(scanner.payload == nil)
        #expect(scanner.failure == nil)
    }

    @Test("Un code TC1, entier ou fragment, est refusé", arguments: ["TC1.a.b", "TC1m.0.2.a"])
    func tc1CodeIsRefused(_ text: String) {
        let scanner = QrScanner()
        scanner.accept(text)
        #expect(scanner.payload == nil)
        #expect(scanner.failure != nil)
    }

    @Test("Un fragment garde les points de son contenu")
    func fragmentKeepsItsDots() {
        let scanner = QrScanner()
        scanner.accept("TC2m.1.2.nonce.donnees")
        scanner.accept("TC2m.0.2.sel.")
        #expect(scanner.payload == "TC2.sel.nonce.donnees")
    }

    @Test("Tant qu'il manque un fragment, rien n'est rendu")
    func incompleteYieldsNothing() {
        let scanner = QrScanner()
        scanner.accept("TC2m.0.3.aaa")
        scanner.accept("TC2m.2.3.ccc")

        #expect(scanner.payload == nil)
        #expect(scanner.progress != nil)
    }
}
