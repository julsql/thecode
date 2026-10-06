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

    @Test("Sans domaine, rien à remplir")
    func requiresADomain() {
        #expect(resolve("moi", vault: Vault(), domain: "") == nil)
        #expect(resolve("", vault: Vault(), domain: " ") == nil)
    }

    @Test("Sans identifiant, site inconnu : nouveau compte v2 sans identifiant")
    func emptyLoginDerivesWithoutLogin() throws {
        let fill = try #require(resolve("   ", vault: Vault()))

        #expect(fill.user == "")
        #expect(fill.isNew)
        #expect(fill.resolution.login == "")
        #expect(fill.resolution.v == 2)
        #expect(fill.resolution.counter == 1)
        #expect(fill.resolution.length == 24)
    }

    @Test("Sans identifiant : l'entrée sans identifiant du site")
    func emptyLoginPicksTheLoginlessEntry() throws {
        let loginless = entry()
        let fill = try #require(
            resolve("", vault: Vault(entries: [entry(login: "alice"), loginless])))

        #expect(fill.resolution.entryId == loginless.id)
        #expect(fill.user == "")
        #expect(!fill.isNew)
    }

    @Test("Sans identifiant, seuls des comptes nommés : nouveau compte sans identifiant")
    func emptyLoginBesideNamedAccountsIsNew() throws {
        let fill = try #require(resolve("", vault: Vault(entries: [entry(login: "alice")])))

        #expect(fill.isNew)
        #expect(fill.user == "")
        #expect(fill.resolution.login == "")
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

    @Test("Compte à part : l'entrée sans identifiant n'est pas réutilisée")
    func separateAccountSkipsTheLoginlessEntry() throws {
        let only = entry()
        let fill = try #require(
            AutofillLogin.resolve(
                login: "moi", domain: "site.fr", vault: Vault(entries: [only]), separate: true,
                length: 24, charset: charset))

        #expect(fill.isNew)
        #expect(fill.resolution.login == "moi")
        #expect(fill.resolution.entryId != only.id)
    }

    @Test("Signale l'identifiant qui retombe sur le compte sans identifiant")
    func tellsWhenTheLoginlessEntryIsKept() throws {
        let kept = try #require(resolve("moi", vault: Vault(entries: [entry()])))
        #expect(AutofillLogin.keepsLoginlessEntry(kept))

        let empty = try #require(resolve("", vault: Vault(entries: [entry()])))
        #expect(!AutofillLogin.keepsLoginlessEntry(empty))
        let known = try #require(resolve("alice", vault: Vault(entries: [entry(login: "alice")])))
        #expect(!AutofillLogin.keepsLoginlessEntry(known))
        let new = try #require(resolve("bob", vault: Vault(entries: [])))
        #expect(!AutofillLogin.keepsLoginlessEntry(new))
    }

    @Test("Propose les identifiants du carnet, les plus utilisés d'abord")
    func suggestsTheLoginsUsedElsewhere() {
        var gone = entry("vieux.fr", login: "ancien")
        gone.deleted = true
        let vault = Vault(entries: [
            entry("a.fr", login: "zoe"), entry("b.fr", login: "moi@exemple.fr"),
            entry("c.fr", login: " moi@exemple.fr "), entry("d.fr", login: "alice"),
            entry("e.fr"), gone, entry("site.fr", login: "alice"),
        ])

        // « alice » est déjà un compte du site : il a son bouton.
        #expect(
            AutofillLogin.suggestions(vault: vault, domain: "site.fr") == ["moi@exemple.fr", "zoe"])
        // À égalité d'usage, l'ordre alphabétique.
        #expect(AutofillLogin.suggestions(vault: vault, domain: "autre.fr", limit: 2)
            == ["alice", "moi@exemple.fr"])
        #expect(AutofillLogin.suggestions(vault: Vault(entries: []), domain: "site.fr").isEmpty)
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

    @Test(
        "Le compte enregistré ensuite redonne le mot de passe rempli",
        arguments: ["moi", ""])
    func savedAccountGivesTheSamePassword(login: String) throws {
        let fill = try #require(resolve(login, vault: Vault()))
        let master = try CoreV2.deriveMasterKey("clef")
        let filled = PasswordUtils().generatePassword(
            for: fill.resolution, masterKey: "clef", master: master, forcing: 2
        ).code

        var vault = Vault()
        let stored = vault.upsert(site: "site.fr", login: fill.user, length: 24, charset: charset)
        // Sans identifiant, l'entrée est enregistrée sans identifiant.
        #expect(stored.login == (login.isEmpty ? nil : login))

        let saved = try #require(resolve(login, vault: vault))
        let again = PasswordUtils().generatePassword(
            for: saved.resolution, masterKey: "clef", master: master, forcing: 2
        ).code

        #expect(!saved.isNew)
        #expect(saved.resolution.entryId == stored.id)
        #expect(filled == again)
    }

    @Test("Ajouter l'identifiant après coup changerait le mot de passe")
    func loginChangesThePassword() throws {
        let master = try CoreV2.deriveMasterKey("clef")
        let without = try #require(resolve("", vault: Vault()))
        let with = try #require(resolve("moi", vault: Vault()))
        let generate = { (fill: AutofillLogin.Fill) in
            PasswordUtils().generatePassword(
                for: fill.resolution, masterKey: "clef", master: master, forcing: 2
            ).code
        }

        #expect(generate(without) != generate(with))
    }
}
