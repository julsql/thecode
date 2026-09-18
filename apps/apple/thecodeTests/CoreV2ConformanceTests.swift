//
//  CoreV2ConformanceTests.swift
//  Conformité de l'algorithme v2, contre les vecteurs partagés.
//
//  Une divergence ici ne se verrait qu'à l'usage : le téléphone rendrait un
//  autre mot de passe que l'ordinateur pour la même entrée du carnet.
//
//  Spécification : shared/spec/algo-v2.md
//

import Foundation
import Testing

@testable import TheCode

private struct VectorFile: Decodable {
    let v2: Section

    struct Section: Decodable {
        let cases: [Case]
    }

    struct Case: Decodable {
        let id: String
        let site: String
        let master: String
        let length: Int
        let login: String
        let counter: Int
        let charset: Charset
        let expected: String
    }
}

private func vectors() throws -> [VectorFile.Case] {
    let url = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .appendingPathComponent("Resources/test-vectors.json")
    return try JSONDecoder().decode(VectorFile.self, from: Data(contentsOf: url)).v2.cases
}

private func utils(length: Int, charset: Charset) -> PasswordUtils {
    let utils = PasswordUtils()
    utils.longueur = length
    utils.minState = charset.lower
    utils.majState = charset.upper
    utils.symState = charset.symbols
    utils.chiState = charset.numbers
    return utils
}

@Suite("Conformance v2 (vecteurs partagés)")
struct CoreV2ConformanceTests {

    @Test("Chaque vecteur est reproduit")
    func matchesEveryVector() throws {
        for testCase in try vectors() {
            let got = utils(length: testCase.length, charset: testCase.charset)
                .generatePasswordV2(
                    masterKey: testCase.master, siteKey: testCase.site,
                    login: testCase.login, counter: testCase.counter)

            #expect(got.code == testCase.expected, "\(testCase.id)")
        }
    }

    @Test("Les champs sont séparés, la concaténation ne peut plus collisionner")
    func separatesFields() throws {
        // En v1, ("google.com", "abc") et ("google.co", "mabc") donnaient le
        // même mot de passe. C'est ce que l'octet nul corrige.
        let master = try CoreV2.deriveMasterKey("clef")
        let tool = utils(length: 20, charset: Charset())

        #expect(
            tool.generatePasswordV2(
                masterKey: "clef", siteKey: "google.com", login: "abc", master: master
            ).code
                != tool.generatePasswordV2(
                    masterKey: "clef", siteKey: "google.co", login: "mabc", master: master
                ).code)
    }

    @Test("Le compteur change le mot de passe")
    func counterChangesThePassword() throws {
        // Sans compteur, rien ne permet de renouveler un mot de passe sans
        // changer la clef maîtresse.
        let master = try CoreV2.deriveMasterKey("clef")
        let tool = utils(length: 20, charset: Charset())

        #expect(
            tool.generatePasswordV2(
                masterKey: "clef", siteKey: "google.com", counter: 1, master: master
            ).code
                != tool.generatePasswordV2(
                    masterKey: "clef", siteKey: "google.com", counter: 2, master: master
                ).code)
    }

    @Test("Le login change le mot de passe")
    func loginChangesThePassword() throws {
        // Deux comptes sur un même site : c'est le problème d'origine.
        let master = try CoreV2.deriveMasterKey("clef")
        let tool = utils(length: 20, charset: Charset())

        #expect(
            tool.generatePasswordV2(
                masterKey: "clef", siteKey: "google.com", login: "moi@example.fr", master: master
            ).code
                != tool.generatePasswordV2(
                    masterKey: "clef", siteKey: "google.com", login: "autre@example.fr",
                    master: master
                ).code)
    }

    @Test("Une clef déjà dérivée donne le même résultat")
    func aDerivedKeyGivesTheSameResult() throws {
        // La dérivation coûte volontairement cher : on doit pouvoir la
        // réutiliser d'un site à l'autre sans changer le résultat.
        let master = try CoreV2.deriveMasterKey("clef")
        let tool = utils(length: 20, charset: Charset())

        #expect(
            tool.generatePasswordV2(masterKey: "clef", siteKey: "google.com").code
                == tool.generatePasswordV2(
                    masterKey: "clef", siteKey: "google.com", master: master
                ).code)
    }
}
