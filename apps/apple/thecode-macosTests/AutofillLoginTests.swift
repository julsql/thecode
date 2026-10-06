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

    @Test func separateAccountSkipsTheLoginlessEntry() throws {
        let only = VaultEntry(siteKey: "julsql.fr", domains: ["julsql.fr"])
        let fill = try #require(
            AutofillLogin.resolve(
                login: "moi", domain: "julsql.fr", vault: Vault(entries: [only]), separate: true,
                length: 20, charset: Charset()))

        #expect(fill.isNew)
        #expect(fill.resolution.login == "moi")
        #expect(fill.resolution.entryId != only.id)
    }

    @Test func tellsWhenTheLoginlessEntryIsKept() throws {
        let loginless = Vault(entries: [VaultEntry(siteKey: "julsql.fr", domains: ["julsql.fr"])])
        #expect(AutofillLogin.keepsLoginlessEntry(try #require(resolve("moi", vault: loginless))))
        #expect(!AutofillLogin.keepsLoginlessEntry(try #require(resolve("", vault: loginless))))
        #expect(
            !AutofillLogin.keepsLoginlessEntry(try #require(resolve("bob", vault: Vault()))))
    }

    @Test func suggestsTheLoginsUsedElsewhere() {
        func entry(_ site: String, _ login: String? = nil) -> VaultEntry {
            VaultEntry(siteKey: site, domains: [site], login: login)
        }
        var gone = entry("vieux.fr", "ancien")
        gone.deleted = true
        let vault = Vault(entries: [
            entry("a.fr", "zoe"), entry("b.fr", "moi@exemple.fr"),
            entry("c.fr", " moi@exemple.fr "), entry("d.fr", "alice"),
            entry("e.fr"), gone, entry("julsql.fr", "alice"),
        ])

        // « alice » est déjà un compte du site : il a son bouton.
        #expect(
            AutofillLogin.suggestions(vault: vault, domain: "julsql.fr")
                == ["moi@exemple.fr", "zoe"])
        #expect(
            AutofillLogin.suggestions(vault: vault, domain: "autre.fr", limit: 2)
                == ["alice", "moi@exemple.fr"])
        #expect(AutofillLogin.suggestions(vault: Vault(), domain: "julsql.fr").isEmpty)
    }
}
