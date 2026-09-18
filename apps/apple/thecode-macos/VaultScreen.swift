//
//  VaultScreen.swift
//  Le carnet, avec la synchronisation chiffrée. Pendant macOS de la vue du
//  même nom dans l'app iOS.
//
//  VaultView (partagée) n'affiche que les entrées. Tout ce qui touche au
//  stockage, aux jetons et au réseau vit ici : la vue partagée reste
//  vérifiable sans conteneur de groupe d'app ni serveur.
//
//  Présentée en feuille et non dans une NavigationView : sur macOS une feuille
//  n'a pas de barre de navigation, les actions vont dans une barre à elle.
//

import SwiftUI

struct VaultScreen: View {

    /// La clef maîtresse chiffre le carnet avant l'envoi. Sans elle il n'y a
    /// rien à synchroniser, et surtout rien à déchiffrer au retour.
    let masterKey: String

    @Binding var isPresented: Bool

    @State private var vault = Vault()
    @State private var status: String?
    @State private var isWorking = false
    @State private var isLinked = SyncCredentialsStore.load() != nil

    @State private var showSignIn = false
    @State private var endpoint = Sync.defaultEndpoint
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text(L10n.t("Carnet", "Vault"))
                    .font(.title2.bold())

                Spacer()

                if isWorking {
                    ProgressView().controlSize(.small)
                }

                if isLinked {
                    Button(L10n.t("Délier", "Unlink"), action: unlink)
                        .buttonStyle(.borderless)
                }

                Button(action: startSync) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                }
                .buttonStyle(.borderless)
                .disabled(isWorking)
                .help(L10n.t("Synchroniser", "Sync"))

                Button(L10n.t("Fermer", "Close")) { isPresented = false }
                    .keyboardShortcut(.cancelAction)
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
            .background(.bar)

            Divider()

            if let status {
                Text(status)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal)
                    .padding(.vertical, 8)
            }

            VaultView(vault: vault)
        }
        .frame(minWidth: 420, minHeight: 440)
        .onAppear { vault = VaultStore.load() }
        .sheet(isPresented: $showSignIn) { signInSheet }
    }

    private var signInSheet: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L10n.t("Synchronisation chiffrée", "Encrypted sync"))
                .font(.headline)

            Text(
                L10n.t(
                    "Votre carnet est chiffré sur cet appareil avant d'être envoyé. Le "
                        + "serveur ne stocke que des blocs opaques : il ne peut lire ni vos "
                        + "sites, ni vos identifiants. Connectez-vous avec les identifiants du "
                        + "compte, jamais avec votre clef maîtresse.",
                    "Your vault is encrypted on this device before it is sent. The server "
                        + "stores opaque blocks and cannot read your sites or logins. Sign in "
                        + "with your account details, never with your master key.")
            )
            .font(.callout)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)

            TextField(L10n.t("Adresse du service", "Service address"), text: $endpoint)
            TextField(L10n.t("Adresse e-mail", "Email"), text: $email)
            SecureField(L10n.t("Mot de passe du compte", "Account password"), text: $password)

            HStack {
                Spacer()
                Button(L10n.t("Annuler", "Cancel")) { showSignIn = false }
                    .keyboardShortcut(.cancelAction)
                Button(L10n.t("Se connecter", "Sign in"), action: signIn)
                    .keyboardShortcut(.defaultAction)
                    .disabled(email.isEmpty || password.isEmpty || endpoint.isEmpty)
            }
        }
        .padding(20)
        .frame(width: 420)
    }

    // MARK: - Actions

    private func startSync() {
        guard !masterKey.isEmpty else {
            status = L10n.t(
                "Définissez d'abord votre clef maîtresse : le carnet est chiffré avec elle "
                    + "avant de quitter cet appareil.",
                "Set your master key first: the vault is encrypted with it before it leaves "
                    + "this device.")
            return
        }

        guard let credentials = SyncCredentialsStore.load() else {
            showSignIn = true
            return
        }
        run {
            try await Sync().syncRenewing(
                VaultStore.load(), masterKey: masterKey, credentials: credentials)
        }
    }

    private func signIn() {
        showSignIn = false
        let endpoint = self.endpoint.trimmingCharacters(in: .whitespaces)
        let email = self.email.trimmingCharacters(in: .whitespaces)
        let password = self.password
        self.password = ""

        run {
            let sync = Sync()
            let credentials = try await sync.login(
                endpoint: endpoint, email: email, password: password,
                deviceLabel: Host.current().localizedName ?? "Mac")
            SyncCredentialsStore.save(credentials)
            return try await sync.syncRenewing(
                VaultStore.load(), masterKey: masterKey, credentials: credentials)
        }
    }

    private func unlink() {
        // Le carnet local reste : délier coupe la synchronisation, cela
        // n'efface rien.
        SyncCredentialsStore.clear()
        isLinked = false
        status = L10n.t(
            "Compte délié. Cet appareil ne se synchronise plus.",
            "Account unlinked. This device no longer syncs.")
    }

    private func run(_ operation: @escaping () async throws -> Sync.Result) {
        isWorking = true
        status = L10n.t("Synchronisation…", "Syncing…")

        Task {
            do {
                let result = try await operation()
                // Les jetons peuvent avoir été renouvelés pendant l'appel : ne
                // pas les réenregistrer forcerait une reconnexion.
                SyncCredentialsStore.save(result.credentials)
                try VaultStore.save(result.vault, to: VaultStore.url())

                await MainActor.run {
                    vault = result.vault
                    isLinked = true
                    let kept = result.vault.entries.filter { $0.deleted != true }.count
                    status =
                        result.conflicts.isEmpty
                        ? L10n.t(
                            "Carnet synchronisé : \(kept) entrées.",
                            "Vault synced: \(kept) entries.")
                        : L10n.t(
                            "Carnet synchronisé : \(kept) entrées, "
                                + "\(result.conflicts.count) demandent votre attention.",
                            "Vault synced: \(kept) entries, \(result.conflicts.count) need "
                                + "your attention.")
                    isWorking = false
                }
            } catch {
                let message = (error as? SyncError)?.message ?? error.localizedDescription
                await MainActor.run {
                    status = L10n.t(
                        "Échec de la synchronisation : \(message)",
                        "Sync failed: \(message)")
                    isWorking = false
                }
            }
        }
    }
}
