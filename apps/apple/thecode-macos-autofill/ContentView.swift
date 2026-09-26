//
//  ContentView.swift
//  thecode-macos-autofill
//
//  Vue racine du NSHostingController de l'extension : les comptes connus du
//  site (un geste chacun), et un champ identifiant pour un site inconnu ou un
//  autre compte. Le système ne dit pas au fournisseur l'identifiant du
//  formulaire : c'est ici qu'on le demande.
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
    @FocusState private var loginFocused: Bool

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 40, weight: .regular))
                .foregroundColor(.accentColor)

            Text("TheCode")
                .font(.title)
                .fontWeight(.bold)

            Text(model.domain)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            if !model.accounts.isEmpty {
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(model.accounts) { account in
                            Button {
                                model.choose(account)
                                if account.login.isEmpty { loginFocused = true }
                            } label: {
                                Text(account.label)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .disabled(model.busy)
                        }
                    }
                }
                .frame(maxHeight: 160)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text(loginPrompt)
                    .font(.footnote)
                    .foregroundColor(.secondary)

                TextField(L10n.t("Identifiant", "Username"), text: $model.login)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.username)
                    .disableAutocorrection(true)
                    .focused($loginFocused)
                    .onSubmit { model.fillTyped() }

                // L'identifiant entre dans le mot de passe (v2) : l'ajouter après
                // en changerait le mot de passe. On le dit avant de remplir. Inutile
                // pour une entrée choisie : son mot de passe n'en dépend pas.
                if model.pinned == nil {
                    Text(L10n.t(
                        "Facultatif. Sans identifiant, le mot de passe est calculé et enregistré sans : saisissez-le maintenant si le site en utilise un, il ne pourra pas être ajouté ensuite sans changer le mot de passe.",
                        "Optional. Without a username, the password is computed and saved without one: type it now if the site uses one, it can't be added later without changing the password."))
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                // Demandé avant de remplir, faute de moment après : l'extension
                // disparaît une fois le mot de passe rendu.
                if model.canSave {
                    Toggle(isOn: $model.saveToVault) {
                        Text(L10n.t("Enregistrer ce compte dans le carnet",
                                    "Save this account to the vault"))
                            .font(.footnote)
                    }
                }
            }

            HStack {
                Button(L10n.t("Annuler", "Cancel")) { model.cancel() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                if model.busy {
                    ProgressView().controlSize(.small)
                }
                Button(L10n.t("Remplir", "Fill")) { model.fillTyped() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(model.busy || model.typedFill == nil)
            }
        }
        .frame(minWidth: 320, minHeight: 300)
        .padding()
        .onAppear {
            if model.accounts.isEmpty { loginFocused = true }
        }
    }

    private var loginPrompt: String {
        if let pinned = model.pinned {
            return L10n.t("Identifiant du compte \(pinned.label)",
                          "Username for \(pinned.label)")
        }
        return model.accounts.isEmpty
            ? L10n.t("Identifiant du compte sur ce site", "Your username on this site")
            : L10n.t("Ou un autre compte", "Or another account")
    }
}
