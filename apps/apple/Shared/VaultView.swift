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

public struct VaultView: View {

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

    public init(vault: Vault, onSelect: ((VaultEntry) -> Void)? = nil) {
        self.onSelect = onSelect
        // Les entrées supprimées portent une pierre tombale pour que la
        // suppression se propage à la synchronisation ; elles n'ont rien à
        // faire à l'écran.
        visibleEntries = vault.entries
            .filter { $0.deleted != true }
            .sorted { Self.label(of: $0).lowercased() < Self.label(of: $1).lowercased() }
    }

    public var body: some View {
        Group {
            if visibleEntries.isEmpty {
                // Une liste vide sans explication se lit comme une panne.
                //
                // ContentUnavailableView serait plus idiomatique mais demande
                // iOS 17, au-dessus de la cible de deploiement de l'app.
                VStack(spacing: 12) {
                    Image(systemName: "tray")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)

                    Text("Carnet vide")
                        .font(.headline)

                    Text(
                        "Aucun site enregistré. Enregistrez-en un depuis l'écran principal "
                            + "pour ne plus avoir à retenir ses réglages."
                    )
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                }
                .padding()
            } else {
                List(visibleEntries, id: \.id) { entry in
                    let row = VStack(alignment: .leading, spacing: 4) {
                        Text(Self.label(of: entry))
                            .font(.headline)

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
                        }
                        .buttonStyle(.plain)
                    } else {
                        row
                    }
                }
            }
        }
        .navigationTitle("Carnet")
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
        return "\(entry.length) caractères, \(charset)"
    }
}
