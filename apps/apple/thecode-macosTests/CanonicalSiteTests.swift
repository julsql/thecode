//
//  CanonicalSiteTests.swift
//  Canonicalisation des hostnames, verifiee contre le referentiel partage
//  shared/canonical-site-cases.json.
//
//  Deux implementations qui canonicalisent differemment produisent deux mots de
//  passe differents pour le meme site. Cette suite est croisee avec celles des
//  autres plateformes, contrairement a DomainNormalizerTests qui ne testait que
//  des cas choisis ici.
//
//  Le fichier est lu depuis les sources via #filePath, et non depuis le bundle,
//  pour eviter de le declarer comme ressource du target.
//

import Foundation
import Testing
import AuthenticationServices

private struct CanonicalSpec: Decodable {
    let schema: Int
    let cases: [Case]

    struct Case: Decodable {
        let id: String
        let hostname: String
        let expected: String
        let divergences: [String: String]?
    }
}

private func loadSpec() throws -> CanonicalSpec {
    let url = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .appendingPathComponent("Resources/canonical-site-cases.json")
    return try JSONDecoder().decode(CanonicalSpec.self, from: Data(contentsOf: url))
}

@Suite("Canonicalisation (referentiel partage)")
struct CanonicalSiteTests {

    private static let impl = "apple"

    @Test("Le referentiel est lisible")
    func specIsReadable() throws {
        let spec = try loadSpec()
        #expect(spec.schema == 1)
        #expect(!spec.cases.isEmpty)
    }

    @Test("Le comportement correspond au referentiel partage")
    func behaviourMatchesTheSharedReference() throws {
        var problems: [String] = []

        for c in try loadSpec().cases {
            // Une divergence documentee verrouille le comportement REEL : la
            // corriger changerait le mot de passe des utilisateurs concernes.
            let want = c.divergences?[Self.impl] ?? c.expected
            let got = DomainNormalizer.registrableDomain(c.hostname)
            if got != want {
                problems.append("\(c.hostname) : attendu \(want), obtenu \(got)")
            }
        }

        #expect(problems.isEmpty, "Ecart avec le referentiel partage :\n\(problems.joined(separator: "\n"))")
    }
}
