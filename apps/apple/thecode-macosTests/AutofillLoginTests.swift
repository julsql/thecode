//
//  AutofillLoginTests.swift
//  thecode-macosTests
//
//  L'extension AutoFill macOS compile la même résolution d'identifiant : on
//  vérifie ici l'identifiant facultatif. Le détail des cas est couvert par
//  thecode-iosTests.
//

import Foundation
import Testing

@testable import TheCode_for_Mac

struct AutofillLoginTests {

    private func resolve(_ login: String, vault: Vault) -> AutofillLogin.Fill? {
        AutofillLogin.resolve(
            login: login, domain: "julsql.fr", vault: vault, length: 20, charset: Charset())
    }

    @Test func noLoginFillsTheLoginlessAccount() throws {
        let fill = try #require(resolve("", vault: Vault()))
        #expect(fill.user == "")
        #expect(fill.isNew)
        #expect(fill.resolution.login == "")
        #expect(fill.resolution.v == 2)

        let only = VaultEntry(siteKey: "julsql.fr")
        let known = try #require(resolve(" ", vault: Vault(entries: [only])))
        #expect(known.resolution.entryId == only.id)
        #expect(!known.isNew)
    }

    @Test func loginlessEntryIsNotAOneGestureFill() {
        #expect(AutofillLogin.quickFill(SiteResolution(entry: VaultEntry(siteKey: "julsql.fr"))) == nil)
    }

    @Test func unknownSiteBecomesANewAccountWithTheLogin() throws {
        let fill = try #require(resolve("moi", vault: Vault()))
        #expect(fill.user == "moi")
        #expect(fill.isNew)
        #expect(fill.resolution.login == "moi")
    }

    @Test func loginlessEntryKeepsItsPasswordButGetsTheUser() throws {
        let only = VaultEntry(siteKey: "julsql.fr")
        let fill = try #require(resolve("moi", vault: Vault(entries: [only])))
        #expect(fill.resolution.entryId == only.id)
        #expect(fill.resolution.login == "")
        #expect(fill.user == "moi")
    }
}
