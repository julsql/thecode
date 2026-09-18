//
//  CanonicalFormTests.swift
//  Forme canonique d'une entrée.
//
//  Elle départage deux écritures au même horodatage. Deux implémentations qui
//  n'écrivent pas la même chaîne désignent un gagnant différent et ne
//  convergent jamais — les tests par plateforme ont déjà laissé passer
//  exactement ce genre d'écart, d'où le fichier partagé.
//
//  Spécification : shared/spec/vault-merge.md
//

import Foundation
import Testing

@testable import TheCode

private struct CanonicalFixture: Decodable {
    let cases: [Case]

    struct Case: Decodable {
        let name: String
        let entry: VaultEntry
        let canonical: String
    }
}

private func fixture() throws -> CanonicalFixture {
    let url = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .appendingPathComponent("Resources/canonical-entries.json")
    return try JSONDecoder().decode(CanonicalFixture.self, from: Data(contentsOf: url))
}

@Suite("Forme canonique")
struct CanonicalFormTests {

    @Test("Correspond à la fixture partagée")
    func matchesTheSharedFixture() throws {
        for testCase in try fixture().cases {
            #expect(testCase.entry.canonical() == testCase.canonical, "\(testCase.name)")
        }
    }

    @Test("Compacte et triée à tous les niveaux")
    func isCompactAndSorted() throws {
        let out = try #require(try fixture().cases.first).entry.canonical()

        #expect(!out.contains("\": "))
        #expect(out.contains("\"charset\":{\"lower\":true,\"numbers\":true,\"symbols\":true,\"upper\":true}"))
    }

    @Test("Retire un deleted faux, garde un deleted vrai")
    func handlesDeleted() throws {
        let cases = try fixture().cases
        let kept = try #require(cases.first { $0.name == "deleted-vrai-conserve" })
        let dropped = try #require(cases.first { $0.name == "deleted-faux-retire" })

        #expect(kept.entry.canonical().contains("\"deleted\":true"))
        #expect(!dropped.entry.canonical().contains("deleted"))
    }

    @Test("Laisse les slashs et les accents tels quels")
    func leavesSlashesAndAccents() throws {
        let case_ = try #require(try fixture().cases.first { $0.name == "accents-et-slash" })
        let out = case_.entry.canonical()

        // JSONEncoder écrit « \/ » par défaut : withoutEscapingSlashes est
        // indispensable, sinon la chaîne diffère des autres implémentations.
        #expect(out.contains("site.fr/chemin"))
        #expect(!out.contains("\\u"))
        #expect(out.contains("Café"))
    }
}
