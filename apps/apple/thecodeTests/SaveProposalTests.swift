//
//  SaveProposalTests.swift
//  Quand l'app propose d'enregistrer un site au carnet.
//

import Testing

@testable import TheCode

@Suite("Proposition d'enregistrement")
struct SaveProposalTests {

    private func vault(site: String, login: String? = nil) -> Vault {
        var entry = VaultEntry(siteKey: site)
        entry.login = login
        return Vault(entries: [entry])
    }

    @Test("Un site inconnu est proposé à qui est connecté")
    func proposesAnUnknownSite() {
        #expect(
            SaveProposal.shouldPropose(
                site: "neuf.fr", login: "", in: vault(site: "autre.fr"), isLinked: true,
                usesV1: false))
    }

    @Test("Rien sans compte de synchronisation")
    func nothingWhenNotLinked() {
        #expect(
            !SaveProposal.shouldPropose(
                site: "neuf.fr", login: "", in: Vault(), isLinked: false, usesV1: false))
    }

    @Test("Rien en v1 : l'entrée v2 donnerait un autre mot de passe")
    func nothingInV1() {
        #expect(
            !SaveProposal.shouldPropose(
                site: "neuf.fr", login: "", in: Vault(), isLinked: true, usesV1: true))
    }

    @Test("Un compte déjà au carnet n'est pas reproposé")
    func knownAccountIsNotProposed() {
        #expect(
            !SaveProposal.shouldPropose(
                site: "site.fr", login: "moi", in: vault(site: "site.fr", login: "moi"),
                isLinked: true, usesV1: false))
        #expect(
            !SaveProposal.shouldPropose(
                site: " site.fr ", login: "", in: vault(site: "site.fr"), isLinked: true,
                usesV1: false))
    }

    @Test("Un autre identifiant sur un site connu est un nouveau compte")
    func anotherLoginIsProposed() {
        #expect(
            SaveProposal.shouldPropose(
                site: "site.fr", login: "pro", in: vault(site: "site.fr", login: "moi"),
                isLinked: true, usesV1: false))
    }

    @Test("Un refus n'est pas reposé")
    func declinedIsNotProposedAgain() {
        let declined: Set = [SaveProposal.key(site: "Neuf.fr", login: "")]
        #expect(
            !SaveProposal.shouldPropose(
                site: "neuf.fr", login: "", in: Vault(), isLinked: true, usesV1: false,
                declined: declined))
    }

    @Test("Un site vide n'est jamais proposé")
    func emptySiteIsNotProposed() {
        #expect(
            !SaveProposal.shouldPropose(
                site: "  ", login: "", in: Vault(), isLinked: true, usesV1: false))
    }
}
