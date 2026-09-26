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
    /// Synchronisation automatique, commune avec l'écran de génération.
    @ObservedObject private var autoSync = AutoSync.shared

    /// Un calcul local ou une synchronisation en cours.
    private var isBusy: Bool { isWorking || autoSync.isRunning }
    @State private var pending: PendingChange? = nil
    @State private var isLinked = SyncCredentialsStore.load() != nil

    @State private var showSignIn = false
    @State private var showTransfer = false
    @State private var endpoint = Sync.defaultEndpoint
    @State private var email = ""
    @State private var password = ""
    @State private var isGoogleWorking = false
    /// Dit par GET /v1/auth/registration ; faux tant qu'il n'a pas répondu.
    @State private var isAppleEnabled = false

    /// `nil` tant que l'identifiant client n'est pas renseigné : pas de bouton.
    private let google = GoogleAuth.configured()

    /// Neuf à chaque présentation ; repart déverrouillé tant que la session
    /// commune avec la clef tient (voir `VaultLockController`).
    @StateObject private var lock = VaultLockController()
    @State private var showLockSettings = false

    /// Entrée ouverte en détail. Relue dans le carnet à chaque rendu : un
    /// renouvellement doit s'y voir sans rouvrir l'écran.
    @State private var selectedID: String?

    private var selectedEntry: VaultEntry? {
        vault.entries.first { $0.id == selectedID && $0.deleted != true }
    }
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationView {
            Group {
                // Le verrou protège l'écran de gestion, pas les données : le
                // remplissage et la génération lisent le carnet sans lui.
                if lock.isUnlocked {
                    unlockedContent
                } else {
                    VaultLockView(lock: lock)
                }
            }
            .navigationBarTitle(L10n.t("Carnet", "Vault"), displayMode: .inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(L10n.t("Fermer", "Close")) { isPresented = false }
                }
                ToolbarItemGroup(placement: .navigationBarTrailing) {
                    if lock.isUnlocked {
                        trailingActions
                    }
                }
            }
        .onAppear {
            lock.resume()
            vault = VaultStore.load()
            autoSync.request(.open)
        }
            .sheet(isPresented: $showSignIn) { signInSheet }
        .sheet(isPresented: $showTransfer) {
            // Le QR transporte le carnet sans serveur : c'est l'option qui
            // rend la synchronisation facultative.
            TransferView(masterKey: masterKey, isPresented: $showTransfer)
                .onDisappear(perform: reloadAfterTransfer)
        }
        .sheet(isPresented: $showLockSettings) {
            VaultLockSettingsView(lock: lock) { showLockSettings = false }
        }
        }
        // Au niveau de la NavigationView : l'alerte doit pouvoir s'ouvrir
        // depuis le détail d'une entrée, poussé par-dessus la liste.
        .alert(pending?.title ?? "", isPresented: Binding(
            get: { pending != nil },
            set: { if !$0 { pending = nil } }
        ), presenting: pending) { change in
            Button(L10n.t("Annuler", "Cancel"), role: .cancel) { pending = nil }
            Button(L10n.t("Confirmer", "Confirm")) {
                apply(change)
                pending = nil
            }
        } message: { change in
            // Les deux côte à côte : le nouveau ne sert à rien tant qu'il n'a
            // pas été posé sur le site, et l'ancien reste celui qui connecte.
            Text(
                L10n.t(
                    """
                    Actuel
                    \(change.before)

                    Nouveau
                    \(change.after)

                    Changez-le sur le site, puis confirmez.
                    """,
                    """
                    Current
                    \(change.before)

                    New
                    \(change.after)

                    Change it on the site, then confirm.
                    """))
        }
        // Session : la sortie de l'écran ou la mise en arrière-plan fait
        // courir les 3 minutes de grâce de la clef, sans verrouiller. Pas sur
        // `.inactive`, que Face ID déclenche lui-même en s'affichant.
        .onChange(of: scenePhase) { phase in
            switch phase {
            case .background: lock.leave()
            case .active: lock.resume()
            default: break
            }
        }
        .onDisappear { lock.leave() }
        // Après une synchronisation réussie, le carnet affiché est relu.
        .onChange(of: autoSync.completedRuns) { _ in
            vault = VaultStore.load()
            isLinked = SyncCredentialsStore.load() != nil
        }
        .onChange(of: lock.isUnlocked) { unlocked in
            if unlocked {
                // Un oubli a pu effacer le carnet entre-temps.
                vault = VaultStore.load()
            } else {
                // Rien de ce qui était ouvert ne doit rester par-dessus le verrou.
                showSignIn = false
                showTransfer = false
                showLockSettings = false
                selectedID = nil
                pending = nil
                status = nil
            }
        }
    }

    @ViewBuilder
    private var trailingActions: some View {
        // Synchroniser et délier vivent dans la section du haut, avec l'état
        // du compte : la barre ne garde que ce qui ne touche pas au compte.
        Button(L10n.t("Transférer", "Transfer")) { showTransfer = true }
            .buttonStyle(.borderless)

        Button { showLockSettings = true } label: {
            Image(systemName: "lock")
        }
        .accessibilityLabel(L10n.t("Verrou du carnet", "Vault lock"))
    }

    /// Section du haut, comme sur Android : la synchronisation à part, avant
    /// le carnet, et non centrée au-dessus de l'état vide.
    ///
    /// La synchronisation est la principale raison de créer un compte, et
    /// rien ne le disait tant qu'aucun n'était lié. Aucune mention d'offre ni
    /// de prix : les règles de l'App Store interdisent d'orienter vers un
    /// paiement.
    @ViewBuilder
    private var syncSection: some View {
        Section(header: Text(L10n.t("Synchronisation", "Sync"))) {
            VStack(alignment: .leading, spacing: 10) {
                if isLinked {
                    Text(
                        L10n.t(
                            "Compte lié : le carnet se synchronise entre vos appareils, "
                                + "chiffré sur chacun avant l'envoi.",
                            "Account linked: the vault syncs across your devices, "
                                + "encrypted on each one before it is sent.")
                    )
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                } else {
                    Text(L10n.t("Synchronisez votre carnet", "Sync your vault"))
                        .font(.headline)

                    Text(
                        L10n.t(
                            "Gardez votre carnet à jour entre vos appareils. Il est "
                                + "chiffré sur cet appareil avant d'être envoyé : le "
                                + "serveur ne peut lire ni vos sites, ni vos identifiants.",
                            "Keep your vault up to date across your devices. It is "
                                + "encrypted on this device before it is sent: the server "
                                + "can read neither your sites nor your logins.")
                    )
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                }

                if let status {
                    Text(status)
                        .font(.footnote)
                        .fixedSize(horizontal: false, vertical: true)
                }

                // Dernier état de la synchronisation, automatique ou non :
                // jamais une alerte, rien que cette ligne.
                if isLinked, let last = autoSync.status {
                    Text(last)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                HStack(spacing: 16) {
                    if isLinked {
                        Button(action: startSync) {
                            HStack(spacing: 6) {
                                if isBusy {
                                    ProgressView()
                                } else {
                                    Image(systemName: "arrow.triangle.2.circlepath")
                                }
                                Text(L10n.t("Synchroniser", "Sync"))
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isBusy)

                        Button(L10n.t("Délier", "Unlink"), role: .destructive, action: unlink)
                            .buttonStyle(.borderless)
                            .disabled(isBusy)
                    } else {
                        // La connexion ouvre la feuille de l'app (e-mail et mot
                        // de passe, ou Google) ; la création de compte reste
                        // sur le site.
                        Button(L10n.t("Se connecter", "Sign in")) { showSignIn = true }
                            .buttonStyle(.borderedProminent)
                            .disabled(isBusy)

                        // Un bouton plutôt qu'un Link : dans une ligne de liste,
                        // un Link prend le toucher de toute la ligne.
                        Button(L10n.t("Créer un compte", "Create an account")) {
                            openURL(accountURL)
                        }
                        .font(.footnote)
                        .buttonStyle(.borderless)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 6)
        }
    }

    private var unlockedContent: some View {
        VaultView(vault: vault, onSelect: { selectedID = $0.id }) {
            syncSection
        }
        .background(
            NavigationLink(
                isActive: Binding(
                    get: { selectedEntry != nil },
                    set: { if !$0 { selectedID = nil } })
            ) {
                if let entry = selectedEntry {
                    VaultEntryDetailView(entry: entry, onRenew: propose, onDelete: delete)
                        .navigationBarTitle(
                            VaultEntryDetailView.label(of: entry), displayMode: .inline)
                }
            } label: {
                EmptyView()
            }
            .hidden()
        )
    }

    /// La page du compte, dans la langue de l'application.
    ///
    /// `from=app` demande au site de n'y montrer ni prix ni abonnement : les
    /// règles de l'App Store interdisent qu'une app oriente vers un paiement
    /// hors de leur système, et un examinateur suit les liens.
    ///
    /// Litteral constant : cette URL ne peut pas ne pas se construire, et un
    /// repli silencieux cacherait une faute de frappe.
    private var accountURL: URL {
        URL(string: L10n.t(
            "https://thecode.julsql.fr/fr/account?from=app",
            "https://thecode.julsql.fr/en/account?from=app"))!
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

                // Apple d'abord : la règle 4.8 le veut au moins aussi visible
                // que Google.
                if isAppleEnabled || google != nil {
                    Section {
                        if isAppleEnabled {
                            AppleSignInButton(onCompletion: signInWithApple)
                                .frame(height: 44)
                                .listRowInsets(EdgeInsets())
                                .disabled(endpoint.isEmpty)
                        }
                        if google != nil {
                            Button(action: signInWithGoogle) {
                                HStack {
                                    Text(L10n.t("Continuer avec Google", "Continue with Google"))
                                    if isGoogleWorking {
                                        Spacer()
                                        ProgressView()
                                    }
                                }
                            }
                            .disabled(endpoint.isEmpty || isGoogleWorking)
                        }
                    }
                }

                // Sans ce lien, un nouveau venu reste devant un formulaire de
                // connexion sans compte à y mettre. Le lien mène à la création
                // de compte, et ne dit rien d'une offre payante.
                Section {
                    Link(
                        L10n.t("Créer un compte sur le site", "Create an account on the site"),
                        destination: accountURL)
                }
            }
            .navigationBarTitle(
                L10n.t("Synchronisation chiffrée", "Encrypted sync"), displayMode: .inline)
            .task(id: endpoint) { await refreshAppleEnabled() }
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


    // MARK: - Renouvellement

    /// Le renouvellement proposé sur une entrée, et ce qu'elle deviendrait.
    ///
    /// Le carnet n'admet que la v2 : il n'y a plus rien à migrer, seul le
    /// compteur peut avancer.
    private struct PendingChange: Identifiable {
        let entry: VaultEntry
        let before: String
        let after: String

        var id: String { entry.id }

        var title: String {
            let label = entry.label.flatMap { $0.isEmpty ? nil : $0 } ?? entry.siteKey
            return L10n.t("Renouveler « \(label) »", "Renew \"\(label)\"")
        }
    }


    /// Le renouvellement demande un compte débloqué.
    ///
    /// Décidé sur l'appareil, forcément : le compteur voyage à l'intérieur du
    /// bloc chiffré, le serveur ne le voit pas et ne peut donc rien en dire.
    /// L'offre connue est celle de la dernière synchronisation.
    private var renewAllowed: Bool {
        SyncPlan.isPaid(SyncCredentialsStore.load()?.plan)
    }

    private func propose(_ entry: VaultEntry) {
        guard !masterKey.isEmpty else {
            status = L10n.t(
                "Définissez d'abord votre clef maîtresse : c'est elle qui calcule les mots "
                    + "de passe.",
                "Set your master key first: it is what computes the passwords.")
            return
        }

        // Le renouvellement demande un compte débloqué. Le message constate,
        // il ne renvoie nulle part : les règles de l'App Store interdisent
        // d'orienter vers un paiement hors de leur système, et une app qui
        // vend depuis un écran de carnet se ferait refuser.
        if !renewAllowed {
            status = L10n.t(
                "Le renouvellement n'est pas activé sur ce compte.",
                "Renewal is not enabled on this account.")
            return
        }

        isWorking = true
        status = L10n.t("Calcul en cours…", "Computing…")

        // Deux dérivations PBKDF2 à 600 000 itérations : jamais sur le fil qui
        // dessine l'écran.
        Task.detached {
            let tool = PasswordUtils()
            let before = tool.generatePassword(
                for: SiteResolution(entry: entry), masterKey: masterKey
            ).code

            // Sur une copie : modifier l'entrée puis renoncer laisserait la
            // porte ouverte à un carnet enregistré à mi-chemin.
            var preview = entry
            preview.counter += 1
            let after = PasswordUtils().generatePassword(
                for: SiteResolution(entry: preview), masterKey: masterKey
            ).code

            await MainActor.run {
                pending = PendingChange(entry: entry, before: before, after: after)
                isWorking = false
                status = nil
            }
        }
    }

    private func apply(_ change: PendingChange) {
        guard let index = vault.entries.firstIndex(where: { $0.id == change.entry.id }) else {
            return
        }

        vault.entries[index].counter += 1
        // Sans réhorodatage, la fusion ferait gagner l'autre appareil et le
        // changement serait perdu à la synchronisation suivante.
        vault.entries[index].updatedAt = Vault.nowIso()

        do {
            try VaultStore.save(vault)
        } catch {
            status = L10n.t(
                "Le carnet n'a pas pu être enregistré.", "The vault could not be saved.")
            return
        }

        autoSync.request(.write)

        let label = change.entry.label.flatMap { $0.isEmpty ? nil : $0 } ?? change.entry.siteKey
        status = L10n.t(
            "« \(label) » renouvelée, compteur \(vault.entries[index].counter).",
            "\"\(label)\" renewed, counter \(vault.entries[index].counter).")
    }

    // MARK: - Suppression

    private func delete(_ entry: VaultEntry) {
        var updated = vault
        // Pierre tombale réhorodatée : la suppression se propage à la
        // synchronisation au lieu d'être annulée par l'autre carnet.
        guard updated.delete(id: entry.id) else { return }

        do {
            try VaultStore.save(updated)
        } catch {
            status = L10n.t(
                "Le carnet n'a pas pu être enregistré.", "The vault could not be saved.")
            return
        }

        vault = updated
        selectedID = nil
        autoSync.request(.write)
        let label = VaultEntryDetailView.label(of: entry)
        status = L10n.t("« \(label) » supprimée.", "\"\(label)\" deleted.")
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

        guard SyncCredentialsStore.load() != nil else {
            showSignIn = true
            return
        }
        status = nil
        autoSync.syncNow()
    }

    private func signIn() {
        showSignIn = false
        let endpoint = self.endpoint.trimmingCharacters(in: .whitespaces)
        let email = self.email.trimmingCharacters(in: .whitespaces)
        let password = self.password
        self.password = ""

        link {
            try await Sync().login(
                endpoint: endpoint, email: email, password: password,
                deviceLabel: await UIDevice.current.name)
        }
    }

    /// Même suite que `signIn`, avec un jeton Google au lieu du mot de passe.
    /// La feuille reste ouverte pendant la fenêtre de Google : fermée sans
    /// rien choisir, on revient au formulaire, sans message.
    private func signInWithGoogle() {
        guard let google else { return }
        let endpoint = self.endpoint.trimmingCharacters(in: .whitespaces)
        isGoogleWorking = true

        Task {
            let idToken: String
            do {
                idToken = try await GoogleSignIn.idToken(using: google)
            } catch {
                isGoogleWorking = false
                if let message = GoogleSignIn.message(for: error) {
                    showSignIn = false
                    status = message
                }
                return
            }
            isGoogleWorking = false
            showSignIn = false

            link {
                try await Sync().googleSignIn(
                    endpoint: endpoint, idToken: idToken, lang: L10n.t("fr", "en"),
                    deviceLabel: await UIDevice.current.name)
            }
        }
    }

    /// Même suite que `signIn`, avec le jeton rendu par la feuille d'Apple.
    /// Fermée sans rien choisir, on revient au formulaire, sans message.
    private func signInWithApple(
        _ result: Result<(identityToken: String, rawNonce: String), Error>
    ) {
        let endpoint = self.endpoint.trimmingCharacters(in: .whitespaces)
        switch result {
        case .failure(let error):
            if let message = AppleSignIn.message(for: error) {
                showSignIn = false
                status = message
            }
        case .success(let signIn):
            showSignIn = false
            link {
                try await Sync().appleSignIn(
                    endpoint: endpoint, identityToken: signIn.identityToken,
                    rawNonce: signIn.rawNonce, lang: L10n.t("fr", "en"),
                    deviceLabel: await UIDevice.current.name)
            }
        }
    }

    /// Relu à chaque adresse saisie, après une courte pause : chaque service
    /// dit s'il accepte Apple.
    private func refreshAppleEnabled() async {
        let endpoint = self.endpoint.trimmingCharacters(in: .whitespaces)
        guard !endpoint.isEmpty else {
            isAppleEnabled = false
            return
        }
        try? await Task.sleep(nanoseconds: 400_000_000)
        guard !Task.isCancelled else { return }
        let enabled = await Sync().appleEnabled(endpoint: endpoint)
        guard !Task.isCancelled else { return }
        isAppleEnabled = enabled
    }

    private func unlink() {
        // Le carnet local reste : délier coupe la synchronisation, cela
        // n'efface rien.
        SyncCredentialsStore.clear()
        isLinked = false
        autoSync.reset()
        status = L10n.t(
            "Compte délié. Cet appareil ne se synchronise plus.",
            "Account unlinked. This device no longer syncs.")
    }

    /// Connexion, puis première synchronisation par le même chemin que les
    /// autres : son état s'affiche dans la même ligne.
    private func link(_ login: @escaping () async throws -> SyncCredentials) {
        isWorking = true
        status = L10n.t("Connexion…", "Signing in…")

        Task {
            do {
                SyncCredentialsStore.save(try await login())
                isLinked = true
                status = nil
                isWorking = false
                autoSync.syncNow()
            } catch {
                status = AutoSync.failureMessage(error)
                isWorking = false
            }
        }
    }

    /// Au retour du transfert : un import a pu fusionner des entrées.
    private func reloadAfterTransfer() {
        let before = vault.entries
        vault = VaultStore.load()
        if vault.entries != before { autoSync.request(.write) }
    }
}
