//
//  DeleteAccountView.swift
//  Suppression du compte depuis l'app, commune à iOS et macOS.
//
//  Exigée par les magasins pour un compte qui peut être créé dans l'app (Se
//  connecter avec Apple ou Google). Deux preuves, comme l'exige l'API :
//  l'adresse recopiée (l'intention) et, si le compte en a un, son mot de
//  passe (l'identité). Les erreurs restent dans la feuille, sous le champ en
//  cause : elle ne se ferme qu'au succès.
//

import SwiftUI

struct DeleteAccountView: View {

    /// Appelé une fois le compte supprimé et les jetons oubliés.
    let onDeleted: () -> Void
    let onCancel: () -> Void

    @State private var identity: Sync.AccountIdentity?
    @State private var loadError: String?
    @State private var email = ""
    @State private var password = ""
    @State private var emailError: String?
    @State private var passwordError: String?
    @State private var otherError: String?
    @State private var isDeleting = false

    private typealias T = L10nSync

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text(T.t("Supprimer le compte ?", "Delete the account?"))
                    .font(.title3.bold())

                if let identity {
                    form(identity)
                } else if let loadError {
                    Text(loadError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack {
                        Button(T.t("Annuler", "Cancel"), action: onCancel)
                        Button(T.t("Réessayer", "Try again")) {
                            Task { await load() }
                        }
                    }
                } else {
                    ProgressView(T.t("Vérification du compte…", "Checking the account…"))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
        #if os(macOS)
            .frame(minWidth: 380, idealWidth: 440, minHeight: 340)
        #endif
        .task { await load() }
    }

    @ViewBuilder
    private func form(_ identity: Sync.AccountIdentity) -> some View {
        Text(
            T.t(
                "Le compte \(identity.email) sera supprimé définitivement du service, avec son "
                    + "carnet chiffré synchronisé, ses réglages synchronisés et les sessions de "
                    + "tous ses appareils. C'est irréversible.",
                "The account \(identity.email) will be permanently deleted from the service, "
                    + "together with its synced encrypted vault, its synced settings and the "
                    + "sessions of all its devices. This cannot be undone.")
        )
        .fixedSize(horizontal: false, vertical: true)

        Text(
            T.t(
                "Le carnet enregistré sur cet appareil est conservé ; cet appareil ne se "
                    + "synchronise plus.",
                "The vault saved on this device is kept; this device stops syncing.")
        )
        .font(.footnote)
        .foregroundStyle(.secondary)
        .fixedSize(horizontal: false, vertical: true)

        VStack(alignment: .leading, spacing: 4) {
            emailField
            fieldError(emailError)
        }

        // Un compte Google ou Apple sans mot de passe n'a rien à saisir ici.
        if identity.hasPassword {
            VStack(alignment: .leading, spacing: 4) {
                SecureField(
                    T.t("Mot de passe du compte", "Account password"),
                    text: Binding(
                        get: { password },
                        set: {
                            password = $0
                            passwordError = nil
                        })
                )
                #if os(macOS)
                    .textFieldStyle(.roundedBorder)
                #endif
                fieldError(passwordError)
            }
        }

        fieldError(otherError)

        HStack(spacing: 12) {
            Button(T.t("Annuler", "Cancel"), action: onCancel)
                .keyboardShortcut(.cancelAction)
                .disabled(isDeleting)

            Spacer()

            if isDeleting { ProgressView() }

            Button(role: .destructive) {
                delete(identity)
            } label: {
                Text(T.t("Supprimer définitivement", "Delete permanently"))
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
            .disabled(!canDelete(identity) || isDeleting)
        }
        .padding(.top, 4)
    }

    private var emailField: some View {
        TextField(
            T.t("Recopiez l'adresse du compte", "Type the account email"),
            text: Binding(
                get: { email },
                set: {
                    email = $0
                    emailError = nil
                })
        )
        #if os(iOS)
            .keyboardType(.emailAddress)
            .textContentType(.emailAddress)
            .autocapitalization(.none)
        #else
            .textFieldStyle(.roundedBorder)
        #endif
        .disableAutocorrection(true)
    }

    @ViewBuilder
    private func fieldError(_ message: String?) -> some View {
        if let message {
            Text(message)
                .font(.footnote)
                .foregroundStyle(.red)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func canDelete(_ identity: Sync.AccountIdentity) -> Bool {
        Sync.emailMatches(email, identity.email) && (!identity.hasPassword || !password.isEmpty)
    }

    // MARK: - Actions

    private func load() async {
        loadError = nil
        guard let creds = SyncCredentialsStore.load() else {
            onCancel()
            return
        }
        do {
            let found = try await Sync().accountIdentity(credentials: creds)
            // Jetons renouvelés en chemin : sans eux, le prochain appel
            // repartirait d'un jeton de renouvellement consommé.
            if SyncCredentialsStore.load() != nil { SyncCredentialsStore.save(found.credentials) }
            identity = found
        } catch {
            let detail = (error as? SyncError)?.message ?? error.localizedDescription
            loadError = T.t(
                "Impossible de lire le compte : \(detail)", "The account could not be read: \(detail)")
        }
    }

    private func delete(_ identity: Sync.AccountIdentity) {
        guard let creds = SyncCredentialsStore.load() else {
            onCancel()
            return
        }
        emailError = nil
        passwordError = nil
        otherError = nil
        isDeleting = true
        let typedEmail = email
        let typedPassword = identity.hasPassword ? password : ""

        Task {
            do {
                try await AutoSync.deleteAccount(
                    credentials: creds, confirmEmail: typedEmail, password: typedPassword
                ) {
                    _ = SyncCredentialsStore.clear()
                }
                password = ""
                isDeleting = false
                onDeleted()
            } catch {
                isDeleting = false
                switch AutoSync.deleteFailure(error) {
                case .wrongPassword: passwordError = AutoSync.DeleteFailure.wrongPassword.message
                case .emailMismatch: emailError = AutoSync.DeleteFailure.emailMismatch.message
                case .other(let message): otherError = message
                }
            }
        }
    }
}
