//
//  VaultEntryDetailView.swift
//  Shared (TheCode iOS / TheCode for Mac)
//
//  Détail d'une entrée du carnet, derrière le verrou : tout ce qui sert à
//  rejouer la dérivation, plus le renouvellement et la suppression. Voir
//  shared/spec/vault-lock.md, section Gestion.
//
//  Le stockage reste l'affaire de VaultScreen : la vue ne fait que proposer.
//

import SwiftUI

struct VaultEntryDetailView: View {

    let entry: VaultEntry
    let onRenew: (VaultEntry) -> Void
    let onDelete: (VaultEntry) -> Void

    @State private var confirmDelete = false

    private typealias T = L10nVault

    var body: some View {
        Form {
            Section {
                if let label = entry.label, !label.isEmpty {
                    row(T.t("Libellé", "Label"), label)
                }
                row("siteKey", entry.siteKey)
                row(T.t("Domaines", "Domains"), entry.domains.joined(separator: "\n"))
                row(T.t("Identifiant", "Login"), entry.login.flatMap { $0.isEmpty ? nil : $0 } ?? "—")
            }

            Section {
                row(T.t("Longueur", "Length"), "\(entry.length)")
                row(T.t("Caractères", "Characters"), Self.charsetSummary(entry.charset))
                row(T.t("Compteur", "Counter"), "\(entry.counter)")
                row(T.t("Mis à jour", "Updated"), Self.formattedDate(entry.updatedAt))
            }

            Section {
                Button(T.t("Renouveler le mot de passe", "Renew the password")) {
                    onRenew(entry)
                }

                Button(T.t("Supprimer l'entrée", "Delete the entry"), role: .destructive) {
                    confirmDelete = true
                }
            }
        }
        #if os(macOS)
        .formStyle(.grouped)
        #endif
        .alert(
            T.t("Supprimer « \(Self.label(of: entry)) » ?", "Delete \"\(Self.label(of: entry))\"?"),
            isPresented: $confirmDelete
        ) {
            Button(T.t("Annuler", "Cancel"), role: .cancel) {}
            Button(T.t("Supprimer", "Delete"), role: .destructive) { onDelete(entry) }
        } message: {
            Text(
                T.t(
                    "L'entrée disparaîtra aussi des autres appareils à la prochaine "
                        + "synchronisation. Le mot de passe du site, lui, ne change pas.",
                    "The entry will also disappear from your other devices at the next sync. "
                        + "The site's password itself does not change."))
        }
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
            Spacer(minLength: 16)
            Text(value)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
                .textSelection(.enabled)
        }
    }

    // MARK: - Mise en forme (statique, pour les tests)

    static func label(of entry: VaultEntry) -> String {
        let label = entry.label ?? ""
        return label.isEmpty ? entry.siteKey : label
    }

    /// Jeux de caractères actifs, dans l'ordre des autres écrans.
    static func charsetSummary(_ charset: Charset) -> String {
        var parts: [String] = []
        if charset.lower { parts.append("a–z") }
        if charset.upper { parts.append("A–Z") }
        if charset.numbers { parts.append("0–9") }
        if charset.symbols { parts.append(T.t("symboles", "symbols")) }
        return parts.isEmpty ? "—" : parts.joined(separator: ", ")
    }

    /// Date lisible dans la langue de l'appareil ; la valeur brute si elle ne
    /// se lit pas, plutôt qu'un champ vide.
    static func formattedDate(_ iso: String, locale: Locale = .current) -> String {
        guard let date = ISO8601DateFormatter().date(from: iso) else { return iso }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
