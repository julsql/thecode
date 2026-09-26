//
//  VaultLockView.swift
//  Shared (TheCode iOS / TheCode for Mac)
//
//  Écrans du verrou du carnet : première ouverture, déverrouillage, oubli, et
//  réglages une fois déverrouillé. La logique est dans VaultLock.swift.
//
//  Partagé entre iOS et macOS. Les chaînes passent par `L10nVault` et non par
//  `L10n` : ce dossier est aussi compilé dans le bundle de tests et dans
//  l'extension, qui ne voient pas tous le `L10n` des apps (même raison que
//  `L10nQr`).
//

import SwiftUI

enum L10nVault {
    static func t(_ fr: String, _ en: String) -> String {
        (Locale.preferredLanguages.first?.lowercased().hasPrefix("fr") ?? false) ? fr : en
    }

    static func biometryName(_ kind: VaultBiometryKind) -> String {
        switch kind {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        case .none: return t("la biométrie", "biometrics")
        }
    }

    static func message(_ error: VaultLockError) -> String {
        switch error {
        case .tooShort:
            return t(
                "Le mot de passe doit faire au moins \(VaultPasswordPolicy.minimumLength) "
                    + "caractères.",
                "The password must be at least \(VaultPasswordPolicy.minimumLength) "
                    + "characters long.")
        case .mismatch:
            return t("Les deux saisies ne correspondent pas.", "The two entries do not match.")
        case .wrongPassword:
            return t("Mot de passe incorrect.", "Wrong password.")
        case .biometricsFailed:
            return t("Authentification échouée.", "Authentication failed.")
        case .biometricsUnavailable:
            return t(
                "La biométrie n'est pas disponible sur cet appareil.",
                "Biometrics are not available on this device.")
        case .storageFailed:
            return t(
                "Le verrou n'a pas pu être enregistré dans le trousseau.",
                "The lock could not be saved to the keychain.")
        case .wipeFailed:
            return t("Le carnet n'a pas pu être effacé.", "The vault could not be erased.")
        }
    }

    static var unlockReason: String {
        t("Déverrouiller le carnet", "Unlock the vault")
    }
}

// MARK: - Verrouillé / première ouverture

struct VaultLockView: View {

    @ObservedObject var lock: VaultLockController

    @Environment(\.scenePhase) private var scenePhase
    @State private var autoPrompted = false

    @State private var password = ""
    @State private var confirmation = ""
    @State private var choosingPassword = false
    @State private var confirmForget = false

    private typealias T = L10nVault

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Image(systemName: "lock.fill")
                    .font(.largeTitle)
                    .foregroundStyle(.secondary)
                    .padding(.top, 24)

                content

                if lock.isBusy {
                    ProgressView()
                }

                if let error = lock.error {
                    Text(T.message(error))
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }
            }
            .frame(maxWidth: 360)
            .padding()
            .frame(maxWidth: .infinity)
        }
        .disabled(lock.isBusy)
        .onAppear(perform: promptBiometricsOnce)
        // Arrivé pendant que l'app n'était pas active (feuille encore en
        // animation, retour d'arrière-plan) : on demande dès qu'elle l'est.
        .onChange(of: scenePhase) { phase in
            if phase == .active { promptBiometricsOnce() }
        }
        .alert(
            T.t("Effacer le carnet local ?", "Erase the local vault?"),
            isPresented: $confirmForget
        ) {
            Button(T.t("Annuler", "Cancel"), role: .cancel) {}
            Button(T.t("Effacer", "Erase"), role: .destructive) {
                password = ""
                lock.forget(wipeVault: { try VaultLockController.wipeLocalVault() })
            }
        } message: {
            Text(
                T.t(
                    "Rien d'autre ne permet de passer le verrou. Le carnet de cet appareil et "
                        + "son verrou seront effacés. Si la synchronisation est active, le "
                        + "carnet reviendra à la prochaine synchronisation.",
                    "Nothing else can get past the lock. This device's vault and its lock "
                        + "will be erased. If sync is on, the vault will come back at the next "
                        + "sync."))
        }
    }

    @ViewBuilder
    private var content: some View {
        switch lock.phase {
        case .setup:
            setup
        case .locked(.password):
            passwordUnlock
        case .locked(.biometrics):
            biometricsUnlock
        case .unlocked:
            EmptyView()
        }
    }

    // MARK: Première ouverture

    @ViewBuilder
    private var setup: some View {
        Text(T.t("Protéger le carnet", "Protect the vault"))
            .font(.headline)

        Text(
            T.t(
                "La gestion du carnet demande une authentification. Ce choix reste sur cet "
                    + "appareil et n'est jamais synchronisé.",
                "Managing the vault requires authentication. This choice stays on this device "
                    + "and is never synced.")
        )
        .font(.callout)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)

        if lock.biometricsAvailable && !choosingPassword {
            Button {
                Task { await lock.chooseBiometrics(reason: T.unlockReason) }
            } label: {
                Label(
                    T.t("Utiliser \(T.biometryName(lock.biometryKind))",
                        "Use \(T.biometryName(lock.biometryKind))"),
                    systemImage: biometryIcon
                )
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)

            Button(T.t("Utiliser un mot de passe de carnet", "Use a vault password")) {
                lock.error = nil
                choosingPassword = true
            }
        } else {
            newPasswordFields

            Button {
                let (first, second) = (password, confirmation)
                Task {
                    if await lock.createPassword(first, confirmation: second) { clearFields() }
                }
            } label: {
                Text(T.t("Créer le mot de passe", "Create the password"))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(password.isEmpty || confirmation.isEmpty)

            if lock.biometricsAvailable {
                Button(T.t("Retour", "Back")) {
                    lock.error = nil
                    clearFields()
                    choosingPassword = false
                }
            }
        }
    }

    @ViewBuilder
    private var newPasswordFields: some View {
        SecureField(T.t("Mot de passe du carnet", "Vault password"), text: $password)
            .modifier(VaultPasswordFieldStyle())
        SecureField(T.t("Confirmer le mot de passe", "Confirm the password"), text: $confirmation)
            .modifier(VaultPasswordFieldStyle())
        Text(
            T.t("\(VaultPasswordPolicy.minimumLength) caractères minimum.",
                "At least \(VaultPasswordPolicy.minimumLength) characters.")
        )
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    // MARK: Déverrouillage

    @ViewBuilder
    private var passwordUnlock: some View {
        Text(T.t("Carnet verrouillé", "Vault locked"))
            .font(.headline)

        SecureField(T.t("Mot de passe du carnet", "Vault password"), text: $password)
            .modifier(VaultPasswordFieldStyle())
            .onSubmit(unlockWithPassword)

        Button(action: unlockWithPassword) {
            Text(T.t("Déverrouiller", "Unlock")).frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .disabled(password.isEmpty)

        forgotButton(T.t("Mot de passe oublié ?", "Forgot password?"))
    }

    @ViewBuilder
    private var biometricsUnlock: some View {
        Text(T.t("Carnet verrouillé", "Vault locked"))
            .font(.headline)

        Button {
            Task { await lock.unlockWithBiometrics(reason: T.unlockReason) }
        } label: {
            Label(
                T.t("Déverrouiller avec \(T.biometryName(lock.biometryKind))",
                    "Unlock with \(T.biometryName(lock.biometryKind))"),
                systemImage: biometryIcon
            )
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)

        forgotButton(T.t("Déverrouillage impossible ?", "Cannot unlock?"))
    }

    private func forgotButton(_ title: String) -> some View {
        Button(title) { confirmForget = true }
            .font(.footnote)
            .buttonStyle(.borderless)
            .padding(.top, 8)
    }

    private var biometryIcon: String {
        switch lock.biometryKind {
        case .faceID: return "faceid"
        case .opticID: return "opticid"
        default: return "touchid"
        }
    }

    private func unlockWithPassword() {
        guard !password.isEmpty else { return }
        let typed = password
        Task {
            if await lock.unlock(password: typed) { clearFields() }
        }
    }

    /// Ouvre la biométrie d'elle-même à l'arrivée sur l'écran : c'est la façon
    /// de se connecter choisie, pas un bouton de plus à chercher. Une seule
    /// fois par affichage : annuler laisse le bouton, sans relancer l'invite.
    private func promptBiometricsOnce() {
        guard !autoPrompted, case .locked(.biometrics) = lock.phase else { return }
        #if os(iOS)
        // L'OS refuse l'invite tant que l'app n'est pas au premier plan ; le
        // changement de scenePhase rappellera.
        guard scenePhase == .active else { return }
        #elseif os(macOS)
        // Reverrouillé parce que l'app est passée derrière : on attend son
        // retour au premier plan (scenePhase rappellera).
        guard NSApplication.shared.isActive else { return }
        #endif
        autoPrompted = true
        Task {
            // Laisse la feuille finir d'apparaître : une invite ouverte pendant
            // l'animation est annulée d'office sur macOS.
            try? await Task.sleep(nanoseconds: 300_000_000)
            await lock.unlockWithBiometrics(reason: T.unlockReason)
        }
    }

    private func clearFields() {
        password = ""
        confirmation = ""
    }
}

// MARK: - Réglages du verrou (déverrouillé)

struct VaultLockSettingsView: View {

    @ObservedObject var lock: VaultLockController
    let onDone: () -> Void

    @State private var current = ""
    @State private var password = ""
    @State private var confirmation = ""
    @State private var done: String?

    private typealias T = L10nVault

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(T.t("Verrou du carnet", "Vault lock"))
                        .font(.headline)
                    Spacer()
                    Button(T.t("Fermer", "Close"), action: onDone)
                        .keyboardShortcut(.cancelAction)
                }

                Text(currentMethodDescription)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                Divider()

                if lock.method == .password {
                    changePassword
                    if lock.biometricsAvailable {
                        Divider()
                        Button(
                            T.t("Utiliser \(T.biometryName(lock.biometryKind)) à la place",
                                "Use \(T.biometryName(lock.biometryKind)) instead")
                        ) {
                            Task {
                                if await lock.switchToBiometrics(reason: T.unlockReason) {
                                    done = T.t("Méthode changée.", "Method changed.")
                                }
                            }
                        }
                    }
                } else if lock.method == .biometrics {
                    switchToPassword
                }

                if lock.isBusy { ProgressView() }

                if let error = lock.error {
                    Text(T.message(error)).font(.footnote).foregroundStyle(.red)
                } else if let done {
                    Text(done).font(.footnote).foregroundStyle(.secondary)
                }
            }
            .padding()
        }
        .disabled(lock.isBusy)
        .onAppear { lock.error = nil }
        #if os(macOS)
        .frame(width: 380, height: 360)
        #endif
    }

    private var currentMethodDescription: String {
        lock.method == .biometrics
            ? T.t("Le carnet s'ouvre avec \(T.biometryName(lock.biometryKind)).",
                "The vault opens with \(T.biometryName(lock.biometryKind)).")
            : T.t("Le carnet s'ouvre avec un mot de passe de carnet.",
                "The vault opens with a vault password.")
    }

    @ViewBuilder
    private var changePassword: some View {
        Text(T.t("Changer le mot de passe", "Change the password"))
            .font(.subheadline.weight(.semibold))
        SecureField(T.t("Mot de passe actuel", "Current password"), text: $current)
            .modifier(VaultPasswordFieldStyle())
        newFields
        Button(T.t("Changer le mot de passe", "Change the password")) {
            let (old, first, second) = (current, password, confirmation)
            Task {
                if await lock.changePassword(current: old, new: first, confirmation: second) {
                    clearFields()
                    done = T.t("Mot de passe changé.", "Password changed.")
                }
            }
        }
        .buttonStyle(.borderedProminent)
        .disabled(current.isEmpty || password.isEmpty || confirmation.isEmpty)
    }

    @ViewBuilder
    private var switchToPassword: some View {
        Text(T.t("Utiliser un mot de passe à la place", "Use a password instead"))
            .font(.subheadline.weight(.semibold))
        newFields
        Button(T.t("Utiliser ce mot de passe", "Use this password")) {
            let (first, second) = (password, confirmation)
            Task {
                if await lock.switchToPassword(first, confirmation: second) {
                    clearFields()
                    done = T.t("Méthode changée.", "Method changed.")
                }
            }
        }
        .buttonStyle(.borderedProminent)
        .disabled(password.isEmpty || confirmation.isEmpty)
    }

    @ViewBuilder
    private var newFields: some View {
        SecureField(T.t("Nouveau mot de passe", "New password"), text: $password)
            .modifier(VaultPasswordFieldStyle())
        SecureField(T.t("Confirmer le mot de passe", "Confirm the password"), text: $confirmation)
            .modifier(VaultPasswordFieldStyle())
        Text(
            T.t("\(VaultPasswordPolicy.minimumLength) caractères minimum.",
                "At least \(VaultPasswordPolicy.minimumLength) characters.")
        )
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    private func clearFields() {
        current = ""
        password = ""
        confirmation = ""
    }
}

/// Champ de mot de passe, même rendu sur les deux plateformes. Pas de
/// `textContentType` : le système proposerait d'enregistrer ou de générer ce
/// mot de passe, qui doit rester propre à cet appareil.
private struct VaultPasswordFieldStyle: ViewModifier {

    func body(content: Content) -> some View {
        #if os(iOS)
        content
            .textFieldStyle(.roundedBorder)
            .autocapitalization(.none)
            .disableAutocorrection(true)
        #else
        content.textFieldStyle(.roundedBorder)
        #endif
    }
}
