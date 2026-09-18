//
//  VaultScreen.swift
//  Le carnet, avec la synchronisation chiffrée.
//
//  VaultView (partagée avec macOS) n'affiche que les entrées. Tout ce qui
//  touche au stockage, aux jetons et au réseau vit ici : la vue partagée reste
//  vérifiable sans conteneur de groupe d'app ni serveur.
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
        NavigationView {
            VStack(spacing: 0) {
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
            .navigationBarTitle(L10n.t("Carnet", "Vault"), displayMode: .inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(L10n.t("Fermer", "Close")) { isPresented = false }
                }
                ToolbarItemGroup(placement: .navigationBarTrailing) {
                    if isLinked {
                        Button(L10n.t("Délier", "Unlink"), action: unlink)
                    }
                    Button(action: startSync) {
                        if isWorking {
                            ProgressView()
                        } else {
                            Image(systemName: "arrow.triangle.2.circlepath")
                        }
                    }
                    .disabled(isWorking)
                    .accessibilityLabel(L10n.t("Synchroniser", "Sync"))
                }
            }
            .onAppear { vault = VaultStore.load() }
            .sheet(isPresented: $showSignIn) { signInSheet }
        }
    }

    private var signInSheet: some View {
        NavigationView {
            Form {
                Section(
                    footer: Text(
                        L10n.t(
                            "Votre carnet est chiffré sur cet appareil avant d'être envoyé. "
                                + "Le serveur ne stocke que des blocs opaques : il ne peut lire "
                                + "ni vos sites, ni vos identifiants. Connectez-vous avec les "
                                + "identifiants du compte, jamais avec votre clef maîtresse.",
                            "Your vault is encrypted on this device before it is sent. The "
                                + "server stores opaque blocks and cannot read your sites or "
                                + "logins. Sign in with your account details, never with your "
                                + "master key."))
                ) {
                    TextField(L10n.t("Adresse du service", "Service address"), text: $endpoint)
                        .keyboardType(.URL)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)

                    TextField(L10n.t("Adresse e-mail", "Email"), text: $email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)

                    SecureField(L10n.t("Mot de passe du compte", "Account password"),
                        text: $password)
                }
            }
            .navigationBarTitle(
                L10n.t("Synchronisation chiffrée", "Encrypted sync"), displayMode: .inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(L10n.t("Annuler", "Cancel")) { showSignIn = false }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(L10n.t("Se connecter", "Sign in"), action: signIn)
                        .disabled(email.isEmpty || password.isEmpty || endpoint.isEmpty)
                }
            }
        }
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
        run { try await Sync().syncRenewing(
            VaultStore.load(), masterKey: masterKey, credentials: credentials) }
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
                deviceLabel: await UIDevice.current.name)
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
