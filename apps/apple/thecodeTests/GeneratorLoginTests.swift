//
//  GeneratorLoginTests.swift
//  L'identifiant saisi sur l'écran de génération.
//
//  Il entre dans la dérivation v2 : l'écran, le carnet et le remplissage
//  automatique doivent donc tous le voir de la même façon.
//

import Foundation
import Testing

@testable import TheCode

@Suite("Identifiant sur l'écran de génération")
struct GeneratorLoginTests {

    private let charset = Charset(lower: true, upper: true, symbols: false, numbers: true)

    @Test("Un identifiant connu met à jour son entrée sans toucher au siteKey")
    func updatesTheMatchingAccount() {
        var entry = VaultEntry(siteKey: "google.com", domains: ["google.com", "google.fr"])
        entry.login = "moi"
        var vault = Vault(entries: [entry])

        let saved = vault.upsert(site: "google.fr", login: "moi", length: 12, charset: charset)

        #expect(vault.entries.count == 1)
        #expect(saved.id == entry.id)
        #expect(saved.siteKey == "google.com")
        #expect(saved.length == 12)
        #expect(saved.charset == charset)
    }

    @Test("Un autre identifiant crée une nouvelle entrée v2")
    func createsAnotherAccount() {
        var entry = VaultEntry(siteKey: "google.com")
        entry.login = "moi"
        var vault = Vault(entries: [entry])

        let saved = vault.upsert(site: "google.com", login: "pro", length: 20, charset: charset)

        #expect(vault.entries.count == 2)
        #expect(saved.id != entry.id)
        #expect(saved.login == "pro")
        #expect(saved.v == 2)
        // L'entrée existante n'est pas touchée.
        #expect(vault.entries.first { $0.id == entry.id }?.length == 20)
        #expect(vault.entries.first { $0.id == entry.id }?.charset == Charset())
    }

    @Test("Un identifiant vide désigne l'entrée sans identifiant")
    func emptyLoginMatchesTheEntryWithoutLogin() {
        let bare = VaultEntry(siteKey: "site.fr")
        var withLogin = VaultEntry(siteKey: "site.fr")
        withLogin.login = "moi"
        var vault = Vault(entries: [withLogin, bare])

        let saved = vault.upsert(site: "site.fr", login: "", length: 16, charset: charset)

        #expect(vault.entries.count == 2)
        #expect(saved.id == bare.id)
    }

    @Test("Un identifiant vide n'est pas enregistré")
    func emptyLoginIsNotStored() {
        var vault = Vault()
        let saved = vault.upsert(site: "site.fr", login: "", length: 16, charset: charset)
        #expect(saved.login == nil)
    }

    @Test("Le carnet suggère l'identifiant du site")
    func suggestsTheRecordedLogin() {
        var entry = VaultEntry(siteKey: "google.com", domains: ["google.com", "google.fr"])
        entry.login = "moi"
        let vault = Vault(entries: [entry])

        #expect(vault.suggestedLogin(for: "google.fr") == "moi")
        #expect(vault.suggestedLogin(for: " google.com ") == "moi")
        #expect(vault.suggestedLogin(for: "inconnu.fr") == nil)
        #expect(vault.suggestedLogin(for: "") == nil)
    }

    @Test("Le préremplissage n'écrase jamais une saisie")
    func prefillKeepsTypedLogin() {
        // Champ vide : on prend la suggestion.
        #expect(Vault.prefilledLogin(typed: "", previousSuggestion: "", suggestion: "moi") == "moi")
        // Valeur venue du carnet : elle suit le site.
        #expect(
            Vault.prefilledLogin(typed: "moi", previousSuggestion: "moi", suggestion: "pro")
                == "pro")
        #expect(Vault.prefilledLogin(typed: "moi", previousSuggestion: "moi", suggestion: nil) == "")
        // Valeur tapée à la main : elle reste.
        #expect(
            Vault.prefilledLogin(typed: "perso", previousSuggestion: "moi", suggestion: "pro")
                == "perso")
    }

    @Test("Le mot de passe de l'écran est celui que rejouera le carnet")
    func generatorMatchesTheSavedEntry() {
        let utils = PasswordUtils()
        utils.longueur = 20
        let shown = utils.generatePasswordV2(masterKey: "clef", siteKey: "site.fr", login: "moi")

        var vault = Vault()
        let saved = vault.upsert(site: "site.fr", login: "moi", length: 20, charset: Charset())
        let replayed = PasswordUtils()
            .generatePassword(for: SiteResolution(entry: saved), masterKey: "clef").code

        #expect(shown.code == replayed)
    }

    @Test("L'identifiant change le mot de passe v2")
    func loginChangesTheV2Password() {
        let utils = PasswordUtils()
        let bare = utils.generatePasswordV2(masterKey: "clef", siteKey: "site.fr").code
        let withLogin = utils.generatePasswordV2(
            masterKey: "clef", siteKey: "site.fr", login: "moi"
        ).code
        #expect(bare != withLogin)

        // Un identifiant vide rend exactement le comportement d'avant.
        #expect(
            utils.generatePasswordV2(masterKey: "clef", siteKey: "site.fr", login: "").code
                == bare)
    }
}
