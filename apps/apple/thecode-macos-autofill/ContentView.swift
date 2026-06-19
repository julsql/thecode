//
//  ContentView.swift
//  thecode-macos-autofill
//
//  Vue présentée par l'extension AutoFill macOS. On ne montre JAMAIS le mot
//  de passe ni la clé : juste « un mot de passe est disponible pour ce
//  domaine » et un bouton qui déclenche Touch ID. La validation effective ne
//  se produit qu'après auth réussie. Si aucune clé n'a été définie dans
//  l'app, on affiche un message d'invite au lieu du bouton.
//

import SwiftUI

// MARK: - Localisation (FR si appareil en français, EN sinon par défaut)
//
// Doublon volontaire de l'enum `L10n` du target principal : les extensions
// AutoFill ne partagent pas le code de l'app hôte.

enum L10n {
    static let isFrench: Bool = {
        guard let primary = Locale.preferredLanguages.first else { return false }
        return primary.lowercased().hasPrefix("fr")
    }()

    static func t(_ fr: String, _ en: String) -> String {
        isFrench ? fr : en
    }
}

struct ContentView: View {

    @ObservedObject var model: AutofillModel

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "lock.shield.fill")
                .font(.system(size: 64, weight: .regular))
                .foregroundColor(.accentColor)

            VStack(spacing: 8) {
                Text("TheCode")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                if model.domain.isEmpty {
                    Text(L10n.t("Aucun domaine détecté", "No domain detected"))
                        .foregroundColor(.secondary)
                } else {
                    Text(L10n.t("Mot de passe disponible pour", "Password available for"))
                        .foregroundColor(.secondary)
                    Text(model.domain)
                        .font(.title3)
                        .fontWeight(.semibold)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }
            }

            if let error = model.errorMessage {
                Text(error)
                    .foregroundColor(.red)
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }

            Spacer()

            Button {
                model.startBiometric()
            } label: {
                HStack {
                    Image(systemName: "touchid")
                    Text(model.busy
                         ? L10n.t("Authentification…", "Authenticating…")
                         : L10n.t("Authentifier pour remplir", "Authenticate to fill"))
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(model.busy || model.domain.isEmpty)
            .padding(.horizontal, 24)

            Button(L10n.t("Annuler", "Cancel"), role: .cancel) {
                model.cancel()
            }
            .padding(.bottom, 24)
        }
        .frame(minWidth: 320, minHeight: 380)
    }
}
