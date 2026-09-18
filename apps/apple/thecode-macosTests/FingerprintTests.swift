//
//  FingerprintTests.swift
//  Empreinte de la clef maîtresse.
//
//  Vérifie aussi l'interopérabilité : la même clef doit donner la même
//  empreinte partout, sinon l'utilisateur verrait deux valeurs différentes
//  selon l'appareil et cesserait de s'y fier.
//

import SwiftUI
import Testing

@Suite("Empreinte de clef")
struct FingerprintTests {

    @Test("Correspond aux autres implémentations")
    func matchesOtherImplementations() {
        // Vecteur produit par le CLI Python, vérifié par l'extension, le site
        // et Android.
        #expect(Fingerprint.of("clef")?.text == "KG8")
    }

    @Test("Est stable")
    func isStable() {
        #expect(Fingerprint.of("clef")?.text == Fingerprint.of("clef")?.text)
    }

    @Test("Attrape une faute de frappe")
    func catchesATypo() {
        let reference = Fingerprint.of("clef")?.text
        #expect(Fingerprint.of("clef ")?.text != reference)
        #expect(Fingerprint.of("Clef")?.text != reference)
        #expect(Fingerprint.of("cled")?.text != reference)
    }

    @Test("Utilise un alphabet sans ambiguïté")
    func unambiguousAlphabet() throws {
        let text = try #require(Fingerprint.of("clef")?.text)
        #expect(text.count == 3)
        for forbidden in "01OIL" {
            #expect(!text.contains(forbidden))
        }
    }

    @Test("Aucune empreinte sans clef")
    func emptyKeyHasNone() {
        #expect(Fingerprint.of("") == nil)
    }
}
