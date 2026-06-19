//
//  ContentView.swift
//  thecode-macos-autofill
//
//  Vue racine du NSHostingController de l'extension. Sur macOS, le flux Safari
//  ne présente pas l'UI custom de l'extension : le remplissage est piloté
//  automatiquement (Touch ID déclenché dès qu'une clé est définie, sinon
//  ouverture de l'app). Cette vue n'est donc qu'un placeholder de marque ;
//  toute la logique vit dans CredentialProviderViewController / AutofillModel.
//

import SwiftUI

// MARK: - Localisation (FR si appareil en français, EN sinon par défaut)
//
// Doublon volontaire de l'enum `L10n` du target principal : les extensions
// AutoFill ne partagent pas le code de l'app hôte. Toujours utilisé par
// AutofillModel pour les libellés d'authentification.

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
        VStack(spacing: 16) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 56, weight: .regular))
                .foregroundColor(.accentColor)

            Text("TheCode")
                .font(.title)
                .fontWeight(.bold)

            if model.busy {
                ProgressView()
            }
        }
        .frame(minWidth: 260, minHeight: 200)
        .padding()
    }
}
