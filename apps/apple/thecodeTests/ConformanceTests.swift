//
//  ConformanceTests.swift
//  Conformité aux vecteurs partagés (shared/test-vectors.json).
//
//  Garde-fou garantissant que les 6 implémentations de TheCode produisent
//  exactement le même mot de passe. Une divergence d'un caractère = un
//  utilisateur qui perd l'accès à ses comptes.
//
//  La section v1 est FIGÉE : ces valeurs sont en production. Si un test échoue
//  ici, ce n'est jamais le vecteur qu'il faut corriger.
//
//  Le fichier est lu depuis les sources via #filePath, et non depuis le bundle :
//  cela évite d'avoir à le déclarer comme ressource du target. C'est une copie
//  synchronisée depuis shared/ (scripts/sync-shared.sh) ; ne jamais l'éditer.
//

import Foundation
import Testing

@testable import TheCode

// MARK: - Modèle des vecteurs partagés

private struct SharedVectors: Decodable {
    let schema: Int
    let v1: V1

    struct V1: Decodable {
        let status: String
        let alphabets: Alphabets
        let cases: [Case]
    }

    struct Alphabets: Decodable {
        let lower: String
        let upper: String
        let symbols: String
        let numbers: String
    }

    struct Charset: Decodable {
        let lower: Bool
        let upper: Bool
        let symbols: Bool
        let numbers: Bool
    }

    struct Case: Decodable {
        let id: String
        let site: String
        let master: String
        let length: Int
        let charset: Charset
        let expected: String
        let bits: Int
    }
}

private func loadSharedVectors() throws -> SharedVectors {
    let url = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .appendingPathComponent("Resources/test-vectors.json")
    let data = try Data(contentsOf: url)
    return try JSONDecoder().decode(SharedVectors.self, from: data)
}

// MARK: - Tests

@Suite("Conformance v1 (vecteurs partagés, figés)")
struct ConformanceTests {

    @Test("Les vecteurs partagés sont lisibles et figés")
    func vectorsAreLoadedAndFrozen() throws {
        let v = try loadSharedVectors()
        #expect(v.schema == 1)
        #expect(v.v1.status == "frozen")
        #expect(!v.v1.cases.isEmpty)
    }

    @Test("Les alphabets correspondent à la spécification partagée")
    func alphabetsMatchSharedSpec() throws {
        let a = try loadSharedVectors().v1.alphabets
        #expect(a.lower == "portezcviuxwhskyajgblndqfm")
        #expect(a.upper == "THEQUICKBROWNFXJMPSVLAZYDG")
        #expect(a.symbols == "@#&!)-%;<:*$+=/?>(")
        #expect(a.numbers == "567438921")
    }

    @Test("Chaque vecteur v1 est reproduit à l'identique")
    func everyV1VectorMatches() throws {
        var failures: [String] = []

        for c in try loadSharedVectors().v1.cases {
            let utils = PasswordUtils()
            utils.longueur = c.length
            utils.minState = c.charset.lower
            utils.majState = c.charset.upper
            utils.symState = c.charset.symbols
            utils.chiState = c.charset.numbers

            // La concaténation est faite par l'appelant côté Apple : le hash
            // porte sur site + clef, dans cet ordre.
            let got = utils.generatePassword(input: c.site + c.master)

            if got.code != c.expected {
                failures.append("\(c.id) : attendu \(c.expected), obtenu \(got.code)")
            }
            if got.bits != c.bits {
                failures.append("\(c.id) : bits attendus \(c.bits), obtenus \(got.bits)")
            }
        }

        #expect(failures.isEmpty, "Divergence avec les vecteurs partagés :\n\(failures.joined(separator: "\n"))")
    }

    @Test("La collision de concaténation v1 est un comportement assumé")
    func v1CollisionIsDocumented() throws {
        let cases = try loadSharedVectors().v1.cases
        let a = try #require(cases.first { $0.id == "collision-a" })
        let b = try #require(cases.first { $0.id == "collision-b" })
        #expect(a.expected == b.expected)
    }
}
