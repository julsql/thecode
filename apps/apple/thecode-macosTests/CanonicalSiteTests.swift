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
        // En repli, registrableDomain refuse de canonicaliser : il n'y a rien a
        // comparer. Le repli lui-meme est couvert par PublicSuffixFallbackTests.
        guard !DomainNormalizer.isUsingFallbackList else { return }

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

@Suite("Repli PSL")
struct PublicSuffixFallbackTests {

    /// Le repli existe parce que Xcode n'embarque pas toujours la ressource.
    /// Le probleme n'etait pas le repli lui-meme mais son silence : la liste
    /// reduite ignore les suffixes prives (github.io, s3.amazonaws.com), donc
    /// elle canonicalise differemment. Les mots de passe produits divergeaient
    /// de ceux des autres plateformes, etaient enregistres sur les sites, et
    /// devenaient irretrouvables ailleurs — sans aucun signal.
    ///
    /// Desormais : os_log en .fault, drapeau observable, et refus de
    /// canonicaliser. Mieux vaut ne rien proposer qu'un mot de passe qui
    /// divergera.
    @Test("En repli, rien n'est canonicalise")
    func fallbackRefusesToCanonicalise() {
        guard DomainNormalizer.isUsingFallbackList else {
            // PSL complete chargee : le comportement nominal est couvert par
            // CanonicalSiteTests.
            return
        }
        #expect(DomainNormalizer.registrableDomain("example.co.uk").isEmpty)
        #expect(DomainNormalizer.registrableDomain("google.com").isEmpty)
    }

    /// La source partagee doit rester une PSL complete : c'est elle que le
    /// build embarque. Un fichier tronque produirait le meme genre de
    /// divergence, sans declencher le repli.
    @Test("La PSL partagee est complete")
    func sharedListIsComplete() throws {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Resources/public_suffix_list.dat")
        let content = try String(contentsOf: url, encoding: .utf8)
        let entries = content
            .split(separator: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty && !$0.hasPrefix("//") }

        #expect(entries.count > 5000)
        // Suffixes prives : precisement ceux que la liste de repli ignore.
        #expect(entries.contains("github.io"))
        #expect(entries.contains("s3.amazonaws.com"))
    }
}
