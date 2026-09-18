//
//  SiteResolutionTests.swift
//  Ce que le carnet apporte au remplissage automatique.
//
//  Sans lui, le remplissage prenait le domaine tel quel avec les réglages
//  généraux : les trois problèmes d'usage d'origine restaient entiers dans ce
//  chemin-là.
//

import Foundation
import Testing

@testable import TheCode

private let general = Charset()

@Suite("Résolution d'un site")
struct SiteResolutionTests {

    @Test("Un site inconnu retombe sur les réglages généraux")
    func fallsBackForAnUnknownSite() {
        // Comportement d'avant le carnet, qui doit rester identique.
        let out = SiteResolution.forDomain(
            "inconnu.fr", in: Vault(), length: 24,
            charset: Charset(lower: true, upper: true, symbols: false, numbers: true))

        #expect(out.count == 1)
        #expect(out[0].siteKey == "inconnu.fr")
        #expect(out[0].entryId.isEmpty)
        #expect(out[0].length == 24)
        #expect(out[0].v == 1)
    }

    @Test("Les réglages enregistrés pour le site sont repris")
    func usesTheRecordedSettings() {
        // Le deuxième problème : ne plus avoir à se souvenir qu'un site
        // n'accepte pas les symboles.
        var entry = VaultEntry(siteKey: "banque.fr")
        entry.length = 12
        entry.charset = Charset(lower: true, upper: true, symbols: false, numbers: true)

        let out = SiteResolution.forDomain(
            "banque.fr", in: Vault(entries: [entry]), length: 20, charset: general)

        #expect(out[0].length == 12)
        #expect(out[0].charset.symbols == false)
    }

    @Test("Un alias mène au même siteKey")
    func followsAnAlias() {
        // Le troisième problème : google.fr doit rendre le mot de passe de
        // google.com, pas un autre.
        let entry = VaultEntry(siteKey: "google.com", domains: ["google.com", "google.fr"])

        let out = SiteResolution.forDomain(
            "google.fr", in: Vault(entries: [entry]), length: 20, charset: general)

        #expect(out.count == 1)
        #expect(out[0].siteKey == "google.com")
    }

    @Test("Tous les comptes du site sont proposés")
    func proposesEveryAccount() {
        // Le premier problème : deux comptes sur un site. On les propose tous
        // plutôt que d'en choisir un au hasard.
        var perso = VaultEntry(siteKey: "google.com")
        perso.login = "moi@example.fr"
        var pro = VaultEntry(siteKey: "google.com#pro", domains: ["google.com"])
        pro.login = "pro@example.fr"

        let out = SiteResolution.forDomain(
            "google.com", in: Vault(entries: [perso, pro]), length: 20, charset: general)

        #expect(out.count == 2)
        #expect(out[0].label.contains("moi@example.fr"))
        #expect(out[1].label.contains("pro@example.fr"))
        // Des siteKey distincts : sinon les deux comptes auraient le même mot
        // de passe, ce qui était le problème de départ.
        #expect(out[0].siteKey != out[1].siteKey)
    }

    @Test("Une entrée supprimée n'est plus proposée")
    func ignoresADeletedEntry() {
        var entry = VaultEntry(siteKey: "google.com")
        entry.deleted = true

        let out = SiteResolution.forDomain(
            "google.com", in: Vault(entries: [entry]), length: 20, charset: general)

        #expect(out[0].entryId.isEmpty)
    }

    @Test("L'entrée choisie est retrouvée par identifiant")
    func findsTheChosenEntry() {
        var entry = VaultEntry(siteKey: "google.com")
        entry.length = 32

        let found = SiteResolution.byId(
            entry.id, in: Vault(entries: [entry]), domain: "google.com", length: 20,
            charset: general)

        #expect(found.length == 32)
    }

    @Test("Une entrée disparue entre-temps retombe sur le repli")
    func fallsBackWhenTheEntryVanished() {
        // Une synchronisation a pu passer entre la suggestion et la validation.
        let found = SiteResolution.byId(
            "un-id-disparu", in: Vault(), domain: "google.com", length: 20, charset: general)

        #expect(found.siteKey == "google.com")
        #expect(found.entryId.isEmpty)
    }
}

@Suite("Génération depuis le carnet")
struct ResolvedGenerationTests {

    @Test("Un site inconnu garde son mot de passe v1")
    func unknownSiteKeepsV1() {
        // Le repli reproduit le comportement d'avant le carnet, au caractère
        // près : un mot de passe déjà en service ne doit pas changer.
        let utils = PasswordUtils()
        utils.longueur = 20
        let expected = utils.generatePassword(input: "google.com" + "clef").code

        let resolution = SiteResolution(
            fallbackFor: "google.com", length: 20, charset: general)

        #expect(
            PasswordUtils().generatePassword(for: resolution, masterKey: "clef").code == expected)
    }

    @Test("Une entrée v2 ne rend pas le mot de passe v1")
    func v2DiffersFromV1() {
        var entry = VaultEntry(siteKey: "google.com")
        entry.v = 2

        let v1 = PasswordUtils().generatePassword(
            for: SiteResolution(fallbackFor: "google.com", length: 20, charset: general),
            masterKey: "clef"
        ).code
        let v2 = PasswordUtils().generatePassword(
            for: SiteResolution(entry: entry), masterKey: "clef"
        ).code

        // Même site, mêmes réglages, version différente : c'est justement ce
        // que l'application ne savait pas faire.
        #expect(v1 != v2)
        #expect(v2.count == 20)
    }

    @Test("Les réglages enregistrés sont appliqués")
    func recordedSettingsApply() {
        var entry = VaultEntry(siteKey: "banque.fr")
        entry.length = 12
        entry.charset = Charset(lower: true, upper: true, symbols: false, numbers: true)

        let password = PasswordUtils().generatePassword(
            for: SiteResolution(entry: entry), masterKey: "clef"
        ).code

        #expect(password.count == 12)
        #expect(password.allSatisfy { $0.isLetter || $0.isNumber })
    }
}
