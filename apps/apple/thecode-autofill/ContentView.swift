//
//  ContentView.swift
//  thecode-autofill
//
//  Vue présentée par l'extension AutoFill. On ne montre JAMAIS le mot de
//  passe ni la clé : juste « un mot de passe est disponible pour ce
//  domaine » et un bouton qui déclenche l'authentification biométrique.
//  La validation effective ne se produit qu'après auth réussie.
//

import SwiftUI

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
                    Text("Aucun domaine détecté")
                        .foregroundColor(.secondary)
                } else {
                    Text("Mot de passe disponible pour")
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
                    Image(systemName: "faceid")
                    Text(model.busy
                         ? "Authentification…"
                         : "Authentifier pour remplir")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(model.busy || model.domain.isEmpty)
            .padding(.horizontal, 24)

            Button("Annuler", role: .cancel) {
                model.cancel()
            }
            .padding(.bottom, 24)
        }
    }
}
