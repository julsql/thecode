//
//  GeneratedPasswordTests.swift
//  Masquage du mot de passe généré et bouton d'enregistrement au carnet.
//

import Testing

@testable import TheCode

@Suite("Mot de passe généré")
struct GeneratedPasswordTests {

    /// Valeurs factices : de simples répétitions, sans allure de secret.
    private let short = String(repeating: "a", count: 4)
    private let long = String(repeating: "b", count: 64)

    @Test("Masqué, il ne montre que le masque")
    func hiddenShowsTheMask() {
        #expect(GeneratedPassword.display(short, revealed: false) == GeneratedPassword.mask)
    }

    @Test("Le masque ne trahit pas la longueur")
    func maskHasAFixedLength() {
        #expect(
            GeneratedPassword.display(short, revealed: false)
                == GeneratedPassword.display(long, revealed: false))
        #expect(GeneratedPassword.mask.count == GeneratedPassword.maskLength)
    }

    @Test("Révélé, il montre la valeur")
    func revealedShowsTheValue() {
        #expect(GeneratedPassword.display(long, revealed: true) == long)
    }

    @Test("Rien à masquer sans mot de passe")
    func emptyStaysEmpty() {
        #expect(GeneratedPassword.display("", revealed: false).isEmpty)
    }

    private func vault(site: String, login: String? = nil, deleted: Bool = false) -> Vault {
        var entry = VaultEntry(siteKey: site)
        entry.login = login
        if deleted { entry.deleted = true }
        return Vault(entries: [entry])
    }

    @Test("Entrée trouvée sur domaine + identifiant : le bouton met à jour")
    func findsTheSameAccount() {
        #expect(vault(site: "exemple.fr", login: "alice").entry(site: "exemple.fr", login: "alice") != nil)
        #expect(vault(site: "exemple.fr").entry(site: " exemple.fr ", login: "") != nil)
    }

    @Test("Autre identifiant, entrée supprimée ou site vide : le bouton enregistre")
    func otherAccountIsANewEntry() {
        #expect(vault(site: "exemple.fr", login: "alice").entry(site: "exemple.fr", login: "bob") == nil)
        #expect(vault(site: "exemple.fr", login: "alice").entry(site: "exemple.fr", login: "") == nil)
        #expect(vault(site: "exemple.fr", deleted: true).entry(site: "exemple.fr", login: "") == nil)
        #expect(vault(site: "exemple.fr").entry(site: "  ", login: "") == nil)
    }

    @Test("entry(site:login:) désigne l'entrée que upsert met à jour")
    func matchesUpsert() {
        var v = vault(site: "exemple.fr", login: "alice")
        let found = v.entry(site: "exemple.fr", login: "alice")
        let saved = v.upsert(
            site: "exemple.fr", login: "alice", length: 20,
            charset: Charset(lower: true, upper: true, symbols: false, numbers: true))
        #expect(found?.id == saved.id)
        #expect(v.entries.count == 1)
    }
}
