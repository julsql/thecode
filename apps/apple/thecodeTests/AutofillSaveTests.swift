//
//  AutofillSaveTests.swift
//  Ce que le carnet retient d'un mot de passe que le système veut enregistrer.
//

import Foundation
import Testing

@testable import TheCode

@Suite("Enregistrement depuis le remplissage automatique")
struct AutofillSaveTests {

    private let key = "clef"
    private let charset = Charset()

    /// Dérivée une fois : PBKDF2 est volontairement lent.
    private static let master = try! CoreV2.deriveMasterKey("clef")

    private func password(site: String, login: String = "", length: Int = 20) -> String {
        let utils = PasswordUtils()
        utils.longueur = length
        return utils.generatePasswordV2(
            masterKey: key, siteKey: site, login: login, master: Self.master
        ).code
    }

    private func plan(
        user: String, password: String, vault: Vault = Vault(), isLinked: Bool = true
    ) -> AutofillSave.Outcome {
        AutofillSave.plan(
            domain: "site.fr", user: user, password: password, vault: vault,
            isLinked: isLinked, masterKey: key, length: 20, charset: charset,
            master: Self.master)
    }

    @Test("Un mot de passe TheCode avec identifiant crée une entrée v2")
    func savesAReproduciblePassword() throws {
        let outcome = plan(user: "moi", password: password(site: "site.fr", login: "moi"))

        guard case .save(let entry) = outcome else {
            Issue.record("attendu .save, obtenu \(outcome)")
            return
        }
        #expect(entry.siteKey == "site.fr")
        #expect(entry.login == "moi")
        #expect(SiteResolution(entry: entry).v == 2)
        #expect(entry.length == 20)
    }

    @Test("Le mot de passe du remplissage sans identifiant est reconnu")
    func recognisesTheLoginlessFallback() {
        // Le remplissage d'un site inconnu dérive sans identifiant : c'est ce
        // mot de passe-là que le formulaire renvoie.
        let outcome = plan(user: "moi", password: password(site: "site.fr"))

        guard case .save(let entry) = outcome else {
            Issue.record("attendu .save, obtenu \(outcome)")
            return
        }
        #expect(entry.login == nil)
    }

    @Test("Un mot de passe choisi à la main n'est jamais enregistré")
    func refusesAHandMadePassword() {
        #expect(plan(user: "moi", password: "MonSuperMotDePasse1!") == .notReproducible)
    }

    @Test("Rien sans compte de synchronisation")
    func nothingWhenNotLinked() {
        #expect(
            plan(user: "moi", password: password(site: "site.fr", login: "moi"), isLinked: false)
                == .notLinked)
    }

    @Test("Un compte déjà au carnet n'est pas réécrit")
    func knownAccountIsLeftAlone() {
        var entry = VaultEntry(siteKey: "site.fr")
        entry.login = "moi"
        #expect(plan(user: "moi", password: "peu importe", vault: Vault(entries: [entry]))
            == .alreadyKnown)
    }

    @Test("Le compte sans identifiant déjà au carnet n'est pas doublé")
    func knownLoginlessAccountIsNotDuplicated() {
        let vault = Vault(entries: [VaultEntry(siteKey: "site.fr")])
        #expect(plan(user: "moi", password: password(site: "site.fr"), vault: vault)
            == .alreadyKnown)
    }

    @Test("Sans clef ni domaine, rien n'est tenté")
    func unusableInput() {
        #expect(
            AutofillSave.plan(
                domain: "", user: "moi", password: "x", vault: Vault(), isLinked: true,
                masterKey: key, length: 20, charset: charset, master: Self.master)
                == .unusable)
        #expect(
            AutofillSave.plan(
                domain: "site.fr", user: "moi", password: "x", vault: Vault(), isLinked: true,
                masterKey: "", length: 20, charset: charset, master: Self.master)
                == .unusable)
    }
}
