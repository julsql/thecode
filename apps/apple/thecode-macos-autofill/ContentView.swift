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
                    .onSubmit { if model.canFillTyped { model.fillTyped() } }

                // Faute de pouvoir lire le formulaire : les identifiants qui
                // servent déjà ailleurs, d'un geste.
                if model.pinned == nil, !model.suggestions.isEmpty {
                    HStack(spacing: 8) {
                        ForEach(model.suggestions, id: \.self) { suggestion in
                            Button(suggestion) { model.login = suggestion }
                                .controlSize(.small)
                                .disabled(model.busy)
                        }
                    }
                }

                // Le site a un compte sans identifiant : par défaut on garde
                // son mot de passe. Le dire, et laisser choisir.
                if model.offersSeparateAccount {
                    Toggle(isOn: $model.separateAccount) {
                        Text(L10n.t(
                            "C'est un autre compte que « \(model.accounts.first?.label ?? model.domain) » : lui donner son propre mot de passe",
                            "This is a different account from “\(model.accounts.first?.label ?? model.domain)”: give it its own password"))
                            .font(.footnote)
                    }
                }

                // L'identifiant entre dans le mot de passe (v2) : l'ajouter après
                // en changerait le mot de passe. On le dit avant de remplir. Inutile
                // pour une entrée choisie : son mot de passe n'en dépend pas.
                if model.pinned == nil {
                    Text(L10n.t(
                        "L'identifiant entre dans le calcul du mot de passe : il ne pourra pas être ajouté ensuite sans le changer. « Ignorer » calcule et enregistre le mot de passe sans identifiant.",
                        "The username is part of the password: it can't be added later without changing it. “Skip” computes and saves the password without a username."))
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
                // S'en passer est un choix explicite, pas un champ laissé vide.
                if model.pinned == nil {
                    Button(L10n.t("Ignorer : sans identifiant", "Skip: no username")) {
                        model.fillWithoutLogin()
                    }
                    .disabled(model.busy || model.domain.isEmpty)
                }
                Button(L10n.t("Remplir", "Fill")) { model.fillTyped() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(model.busy || !model.canFillTyped)
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
