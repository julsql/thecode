//
//  VaultView.swift
//  Écran du carnet.
//
//  Le carnet ne contient aucun mot de passe : seulement de quoi rejouer une
//  dérivation. Cet écran sert à voir ce qui est enregistré et à retrouver quels
//  réglages s'appliquent à quel site — précisément ce qu'on ne pouvait plus
//  savoir avant qu'il existe.
//
//  Source unique : shared/apple/VaultView.swift
//

import SwiftUI

public struct VaultView<Header: View>: View {

    /// Entrées réellement affichées : filtrées et triées.
    ///
    /// Exposée pour que le tri et le filtrage soient vérifiables sans rendre
    /// la vue.
    let visibleEntries: [VaultEntry]

    /// Action proposée sur une entrée, ou `nil` quand la vue n'en offre pas.
    ///
    /// Renouveler touche au stockage et à la dérivation : la vue
    /// partagée reste vérifiable sans conteneur de groupe d'app ni clef
    /// maîtresse, et l'app décide quoi en faire.
    private let onSelect: ((VaultEntry) -> Void)?

    /// Sections posées en tête de liste, avant les entrées : l'app y met la
    /// synchronisation, qui touche au réseau et n'a rien à faire ici.
    private let header: Header

    public init(
        vault: Vault, onSelect: ((VaultEntry) -> Void)? = nil,
        @ViewBuilder header: () -> Header
    ) {
        self.onSelect = onSelect
        self.header = header()
        // Les entrées supprimées portent une pierre tombale pour que la
        // suppression se propage à la synchronisation ; elles n'ont rien à
        // faire à l'écran.
        visibleEntries = vault.entries
            .filter { $0.deleted != true }
            .sorted { Self.label(of: $0).lowercased() < Self.label(of: $1).lowercased() }
    }

    public var body: some View {
        // Une seule liste, en sections : la tête et le carnet (ou son état
        // vide) restent séparés et alignés à gauche, au lieu d'un bloc
        // centré collé sous ce qui précède.
        List {
            header

            // Chaque entrée est chiffrée avec la clef : une autre clef ne voit
            // pas celles des autres appareils, sans erreur visible.
            Section {
                Text(
                    L10nVault.t(
                        "Si vous ne voyez pas tous vos mots de passe, vérifiez que vous "
                            + "utilisez la même clef.",
                        "If you don't see all your passwords, check that you are using "
                            + "the same key.")
                )
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            }

            if visibleEntries.isEmpty {
                // Une liste vide sans explication se lit comme une panne.
                //
                // ContentUnavailableView serait plus idiomatique mais demande
                // iOS 17, au-dessus de la cible de deploiement de l'app.
                Section {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: "tray")
                            .font(.title2)
                            .foregroundStyle(.secondary)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(L10nVault.t("Carnet vide", "Empty vault"))
                                .font(.headline)

                            Text(
                                L10nVault.t(
                                    "Aucun site enregistré. Enregistrez-en un depuis l'écran "
                                        + "principal pour ne plus avoir à retenir ses réglages.",
                                    "No site saved yet. Save one from the main screen so you "
                                        + "no longer have to remember its settings.")
                            )
                            .font(.callout)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 6)
                }
            } else {
                Section(header: Text(L10nVault.t("Sites", "Sites"))) {
                    ForEach(visibleEntries, id: \.id) { entry in
                        row(for: entry)
                    }
                }
            }
        }
        #if os(iOS)
        .listStyle(.insetGrouped)
        #else
        .listStyle(.inset)
        #endif
        .navigationTitle(L10nVault.t("Carnet", "Vault"))
    }

    @ViewBuilder
    private func row(for entry: VaultEntry) -> some View {
        let row = VStack(alignment: .leading, spacing: 4) {
            Text(Self.label(of: entry))
                .font(.headline)

            if let login = entry.login, !login.isEmpty {
                Text(login)
                    .font(.subheadline)
            }

            Text(entry.domains.joined(separator: ", "))
                .font(.caption)
                .foregroundStyle(.secondary)

            Text(settings(of: entry))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)

        if let onSelect {
            Button { onSelect(entry) } label: {
                row.frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        } else {
            row
        }
    }

    // Statique : le tri s'en sert dans l'init, avant que l'instance existe.
    private static func label(of entry: VaultEntry) -> String {
        let label = entry.label ?? ""
        return label.isEmpty ? entry.siteKey : label
    }

    /// Résumé compact des réglages, dans la même forme que les autres écrans.
    private func settings(of entry: VaultEntry) -> String {
        var charset = ""
        if entry.charset.lower { charset += "a" }
        if entry.charset.upper { charset += "A" }
        if entry.charset.symbols { charset += "#" }
        if entry.charset.numbers { charset += "1" }
        return L10nVault.t(
            "\(entry.length) caractères, \(charset)", "\(entry.length) characters, \(charset)")
    }
}

extension VaultView where Header == EmptyView {
    /// Le carnet seul, sans rien en tête.
    public init(vault: Vault, onSelect: ((VaultEntry) -> Void)? = nil) {
        self.init(vault: vault, onSelect: onSelect) { EmptyView() }
    }
}
