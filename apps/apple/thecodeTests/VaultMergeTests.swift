//
//  VaultMergeTests.swift
//  Carnet : fusion vérifiée contre les cas partagés.
//
//  La règle doit être identique sur les cinq implémentations : deux appareils
//  qui fusionnent les mêmes carnets doivent aboutir au même résultat, sinon ils
//  repartent en divergence à la synchronisation suivante.
//
//  Le fichier est lu depuis les sources via #filePath, et non depuis le bundle.
//

import Foundation
import Testing

@testable import TheCode

private struct MergeSpec: Decodable {
    let cases: [Case]

    struct Case: Decodable {
        let id: String
        let why: String
        let left: Vault
        let right: Vault
        let expected: Vault
        let conflicts: [String]
    }
}

private func loadSpec() throws -> MergeSpec {
    let url = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .appendingPathComponent("Resources/merge-cases.json")
    return try JSONDecoder().decode(MergeSpec.self, from: Data(contentsOf: url))
}

private struct SelectionSpec: Decodable {
    let cases: [Case]

    struct Case: Decodable {
        let id: String
        let why: String
        let vault: Vault
        let remoteIds: [String]
        let maxEntries: Int
        let push: [String]
        let localOnly: [String]
    }
}

private func loadSelection() throws -> SelectionSpec {
    let url = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .appendingPathComponent("Resources/sync-selection.json")
    return try JSONDecoder().decode(SelectionSpec.self, from: Data(contentsOf: url))
}

/// Compare deux carnets sur ce qui compte, indépendamment de l'ordre.
private func signature(_ vault: Vault) -> [String] {
    vault.entries.map { $0.canonical() }.sorted()
}

@Suite("Carnet — fusion")
struct VaultMergeTests {

    @Test("Chaque cas partagé produit le carnet attendu")
    func everySharedCaseMatches() throws {
        var problems: [String] = []

        for c in try loadSpec().cases {
            let (got, conflicts) = Vault.merge(c.left, c.right)
            if signature(got) != signature(c.expected) {
                problems.append("\(c.id) : \(c.why)")
            }
            let kinds = Set(conflicts.map(\.kind))
            if kinds != Set(c.conflicts) {
                problems.append("\(c.id) : conflits \(kinds.sorted()) au lieu de \(c.conflicts.sorted())")
            }
        }

        #expect(problems.isEmpty, "Ecart avec les cas partages :\n\(problems.joined(separator: "\n"))")
    }

    @Test("La fusion est commutative")
    func mergeIsCommutative() throws {
        for c in try loadSpec().cases {
            // siteKey divergent est volontairement asymétrique : on garde celui
            // de gauche plutôt que de trancher à la place de l'utilisateur.
            if c.conflicts.contains("sitekey-divergent") { continue }
            let (a, _) = Vault.merge(c.left, c.right)
            let (b, _) = Vault.merge(c.right, c.left)
            #expect(signature(a) == signature(b), "\(c.id)")
        }
    }

    @Test("La fusion est idempotente")
    func mergeIsIdempotent() throws {
        for c in try loadSpec().cases {
            let (once, _) = Vault.merge(c.left, c.right)
            let (twice, _) = Vault.merge(once, c.right)
            #expect(signature(twice) == signature(once), "\(c.id)")
        }
    }
}

@Suite("Carnet — synchronisation partielle")
struct SyncSelectionTests {

    @Test("Chaque cas partagé pousse et garde les entrées attendues")
    func everySharedCaseMatches() throws {
        for c in try loadSelection().cases {
            let (push, localOnly) = Vault.selectForPush(
                c.vault, remoteIds: c.remoteIds, maxEntries: c.maxEntries)
            #expect(push.map(\.id) == c.push, "\(c.id) : \(c.why)")
            #expect(localOnly.map(\.id) == c.localOnly, "\(c.id) : \(c.why)")
        }
    }
}

@Suite("Carnet — date de création")
struct CreatedAtTests {

    @Test("Est posée à la création")
    func isSetOnCreation() {
        let entry = VaultEntry(siteKey: "google.com")
        #expect(entry.createdAt != nil)
        #expect(entry.createdAt == entry.updatedAt)
    }

    @Test("Est posée par l'enregistrement d'un nouveau compte")
    func isSetByUpsert() {
        var vault = Vault()
        let entry = vault.upsert(site: "google.com", login: "moi", length: 20, charset: Charset())
        #expect(entry.createdAt == entry.updatedAt)
    }
}

@Suite("Carnet — les trois problèmes d'origine")
struct VaultProblemsTests {

    @Test("Un compte, plusieurs domaines")
    func oneAccountSeveralDomains() {
        let vault = Vault(entries: [
            VaultEntry(siteKey: "google.com", domains: ["google.com", "google.fr", "youtube.com"])
        ])
        for domain in ["google.com", "google.fr", "youtube.com"] {
            #expect(vault.find(domain: domain)?.siteKey == "google.com")
        }
    }

    @Test("Plusieurs comptes, un site")
    func severalAccountsOneSite() {
        let vault = Vault(entries: [
            VaultEntry(siteKey: "google.com", domains: ["google.com"]),
            VaultEntry(siteKey: "google.com#pro", domains: ["google.com"]),
        ])
        #expect(vault.findAll(domain: "google.com").count == 2)
    }

    @Test("Les paramètres sont par entrée")
    func parametersArePerEntry() {
        let vault = Vault(entries: [
            VaultEntry(siteKey: "a.com", length: 32),
            VaultEntry(siteKey: "b.com", length: 12),
        ])
        #expect(vault.find(domain: "a.com")?.length == 32)
        #expect(vault.find(domain: "b.com")?.length == 12)
    }

    @Test("Une entrée supprimée ne remonte plus")
    func deletedEntriesAreHidden() {
        var entry = VaultEntry(siteKey: "google.com")
        entry.deleted = true
        let vault = Vault(entries: [entry])
        #expect(vault.find(domain: "google.com") == nil)
    }
}
