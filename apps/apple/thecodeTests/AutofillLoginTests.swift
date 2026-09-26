//
//  AutofillLoginTests.swift
//  Quel compte le remplissage automatique remplit, sous quel identifiant.
//

import Foundation
import Testing

@testable import TheCode

@Suite("Identifiant du remplissage automatique")
struct AutofillLoginTests {

    private let charset = Charset(lower: true, upper: true, symbols: false, numbers: true)

    private func entry(_ site: String = "site.fr", login: String? = nil) -> VaultEntry {
        var e = VaultEntry(siteKey: site, domains: [site], login: login)
        e.length = 16
        return e
    }

    private func resolve(
        _ login: String, vault: Vault, pinned: String? = nil, domain: String = "site.fr"
    ) -> AutofillLogin.Fill? {
        AutofillLogin.resolve(
            login: login, domain: domain, vault: vault, pinned: pinned, length: 24,
            charset: charset)
    }

    @Test("Sans identifiant saisi, rien à remplir")
    func requiresALogin() {
        #expect(resolve("", vault: Vault()) == nil)
        #expect(resolve("   ", vault: Vault(entries: [entry(login: "moi")])) == nil)
        #expect(resolve("moi", vault: Vault(), domain: "") == nil)
    }

    @Test("Site inconnu : nouveau compte v2 dérivé avec l'identifiant")
    func unknownSiteDerivesWithTheLogin() throws {
        let fill = try #require(resolve("  moi@x.fr ", vault: Vault()))

        #expect(fill.user == "moi@x.fr")
        #expect(fill.isNew)
        #expect(fill.resolution.login == "moi@x.fr")
        #expect(fill.resolution.siteKey == "site.fr")
        #expect(fill.resolution.v == 2)
        #expect(fill.resolution.counter == 1)
        // Réglages généraux : ceux qu'aurait l'entrée enregistrée.
        #expect(fill.resolution.length == 24)
        #expect(fill.resolution.charset == charset)
    }

    @Test("Identifiant d'une entrée du site : cette entrée")
    func matchingLoginPicksTheEntry() throws {
        let alice = entry(login: "alice")
        let bob = entry(login: "bob")
        let fill = try #require(resolve("bob", vault: Vault(entries: [alice, bob])))

        #expect(fill.resolution.entryId == bob.id)
        #expect(fill.user == "bob")
        #expect(!fill.isNew)
        #expect(fill.resolution.length == 16)
    }

    @Test("Seule entrée, sans identifiant : on la garde, identifiant rendu au site")
    func loginlessSingleEntryIsKept() throws {
        let only = entry()
        let fill = try #require(resolve("moi", vault: Vault(entries: [only])))

        #expect(fill.resolution.entryId == only.id)
        // Le mot de passe du compte ne change pas : la dérivation reste sans
        // identifiant.
        #expect(fill.resolution.login == "")
        #expect(fill.user == "moi")
        #expect(!fill.isNew)
    }

    @Test("Un autre identifiant qu'une seule entrée qui en porte un : nouveau compte")
    func otherLoginIsAnotherAccount() throws {
        let fill = try #require(resolve("bob", vault: Vault(entries: [entry(login: "alice")])))

        #expect(fill.isNew)
        #expect(fill.resolution.login == "bob")
    }

    @Test("Plusieurs entrées dont une sans identifiant : un inconnu est un nouveau compte")
    func severalEntriesUnknownLoginIsNew() throws {
        let fill = try #require(
            resolve("carol", vault: Vault(entries: [entry(), entry(login: "alice")])))

        #expect(fill.isNew)
        #expect(fill.resolution.login == "carol")
    }

    @Test("Entrée choisie dans la liste : elle l'emporte sur l'identifiant saisi")
    func pinnedEntryWins() throws {
        let loginless = entry()
        let alice = entry(login: "alice")
        let fill = try #require(
            resolve("moi", vault: Vault(entries: [loginless, alice]), pinned: loginless.id))

        #expect(fill.resolution.entryId == loginless.id)
        #expect(fill.user == "moi")
        #expect(!fill.isNew)
    }

    @Test("Les entrées supprimées et celles d'autres sites ne comptent pas")
    func ignoresDeletedAndOtherSites() throws {
        var gone = entry(login: "moi")
        gone.deleted = true
        let fill = try #require(
            resolve("moi", vault: Vault(entries: [gone, entry("autre.fr", login: "moi")])))

        #expect(fill.isNew)
    }

    @Test("Un geste par compte connu, sauf sans identifiant")
    func quickFillNeedsALogin() throws {
        let fill = try #require(AutofillLogin.quickFill(SiteResolution(entry: entry(login: "moi"))))
        #expect(fill.user == "moi")
        #expect(!fill.isNew)

        #expect(AutofillLogin.quickFill(SiteResolution(entry: entry())) == nil)
    }

    @Test("Jamais d'identifiant vide rendu au système")
    func neverAnEmptyUser() {
        let vaults = [
            Vault(), Vault(entries: [entry()]), Vault(entries: [entry(login: "a")]),
            Vault(entries: [entry(), entry(login: "a")]),
        ]
        for vault in vaults {
            for typed in ["", " ", "a", "b"] {
                if let fill = resolve(typed, vault: vault) {
                    #expect(!fill.user.isEmpty)
                }
            }
        }
    }

    @Test("Le compte enregistré ensuite redonne le mot de passe rempli")
    func savedAccountGivesTheSamePassword() throws {
        let fill = try #require(resolve("moi", vault: Vault()))
        let master = try CoreV2.deriveMasterKey("clef")
        let filled = PasswordUtils().generatePassword(
            for: fill.resolution, masterKey: "clef", master: master, forcing: 2
        ).code

        var vault = Vault()
        vault.upsert(site: "site.fr", login: fill.user, length: 24, charset: charset)
        let saved = try #require(resolve("moi", vault: vault))
        let again = PasswordUtils().generatePassword(
            for: saved.resolution, masterKey: "clef", master: master, forcing: 2
        ).code

        #expect(!saved.isNew)
        #expect(filled == again)
    }
}
