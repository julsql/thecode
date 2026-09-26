//
//  ContentView.swift
//  thecode-autofill
//
//  Vue présentée par l'extension AutoFill. On ne montre JAMAIS le mot de
//  passe ni la clé : les comptes connus du site (un geste chacun) et un champ
//  identifiant pour un site inconnu ou un autre compte. La validation
//  effective ne se produit qu'après auth biométrique réussie.
//

import SwiftUI

// MARK: - Localisation (FR si appareil en français, EN sinon par défaut)
//
// Doublon volontaire de l'enum `L10n` du target principal : les extensions
// AutoFill ne partagent pas le code de l'app hôte, et `MainView.swift` n'est
// pas compilé dans ce target. On lit `Locale.preferredLanguages` (et non
// `Locale.current`) car sans bundle .lproj/CFBundleLocalizations, iOS
// retomberait toujours sur la langue de développement (FR) — d'où l'écran
// d'authentification toujours en français sur un téléphone en anglais.

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
        VStack(spacing: 20) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 48, weight: .regular))
                .foregroundColor(.accentColor)
                .padding(.top, 24)

            VStack(spacing: 8) {
                Text("TheCode")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                if model.domain.isEmpty {
                    Text(L10n.t("Aucun domaine détecté", "No domain detected"))
                        .foregroundColor(.secondary)
                } else {
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

            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    // Un geste par compte connu : biométrie puis remplissage.
                    ForEach(model.accounts) { account in
                        Button {
                            model.choose(account)
                            if account.login.isEmpty { loginFocused = true }
                        } label: {
                            Text(account.label)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, 4)
                        }
                        .buttonStyle(.bordered)
                        .disabled(model.busy)
                    }

                    // Le système ne dit pas l'identifiant du formulaire : on
                    // le demande pour un site inconnu ou un autre compte.
                    Text(loginPrompt)
                        .font(.footnote)
                        .foregroundColor(.secondary)
                        .padding(.top, model.accounts.isEmpty ? 0 : 8)

                    TextField(L10n.t("Identifiant", "Username"), text: $model.login)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.username)
                        .textInputAutocapitalization(.never)
                        .disableAutocorrection(true)
                        .focused($loginFocused)
                        .submitLabel(.go)
                        .onSubmit { model.fillTyped() }

                    // Demandé avant de remplir, faute de moment après :
                    // l'extension disparaît une fois le mot de passe rendu.
                    if model.canSave {
                        Toggle(isOn: $model.saveToVault) {
                            Text(L10n.t("Enregistrer ce compte dans le carnet",
                                        "Save this account to the vault"))
                                .font(.footnote)
                        }
                    }
                }
                .padding(.horizontal, 24)
            }

            Button {
                model.fillTyped()
            } label: {
                HStack {
                    Image(systemName: "faceid")
                    Text(model.busy
                         ? L10n.t("Authentification…", "Authenticating…")
                         : L10n.t("Remplir", "Fill"))
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(model.busy || model.typedFill == nil)
            .padding(.horizontal, 24)

            Button(L10n.t("Annuler", "Cancel"), role: .cancel) {
                model.cancel()
            }
            .padding(.bottom, 24)
        }
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
