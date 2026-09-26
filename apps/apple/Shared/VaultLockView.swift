//
//  VaultLockView.swift
//  Shared (TheCode iOS / TheCode for Mac)
//
//  Écran du verrou du carnet : authentification de l'appareil, ou ressaisie de
//  la clef maîtresse sur un appareil qui n'en a aucune. La logique est dans
//  VaultLock.swift.
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

    static func message(_ error: VaultLockError) -> String {
        switch error {
        case .deviceAuthFailed:
            return t("Authentification échouée.", "Authentication failed.")
        case .wrongMasterKey:
            return t(
                "Ce n'est pas la clef maîtresse de cet appareil.",
                "This is not this device's master key.")
        case .noMasterKey:
            return t(
                "Aucune clef maîtresse sur cet appareil. Définissez-en une sur l'écran "
                    + "principal.",
                "No master key on this device. Set one on the main screen.")
        }
    }

    static var unlockReason: String {
        t("Déverrouiller le carnet", "Unlock the vault")
    }
}

// MARK: - Verrouillé

struct VaultLockView: View {

    @ObservedObject var lock: VaultLockController

    @Environment(\.scenePhase) private var scenePhase
    @State private var autoPrompted = false
    @State private var typedKey = ""

    private typealias T = L10nVault

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Image(systemName: "lock.fill")
                    .font(.largeTitle)
                    .foregroundStyle(.secondary)
                    .padding(.top, 24)

                Text(T.t("Carnet verrouillé", "Vault locked"))
                    .font(.headline)

                switch lock.method {
                case .device: deviceUnlock
                case .masterKey: masterKeyUnlock
                }

                if lock.isBusy {
                    ProgressView()
                }

                if let error = lock.error {
                    Text(T.message(error))
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: 360)
            .padding()
            .frame(maxWidth: .infinity)
        }
        .disabled(lock.isBusy)
        .onAppear(perform: promptOnce)
        // Arrivé pendant que l'app n'était pas active (feuille encore en
        // animation, retour d'arrière-plan) : on demande dès qu'elle l'est.
        .onChange(of: scenePhase) { phase in
            if phase == .active { promptOnce() }
        }
    }

    // MARK: Appareil

    private var deviceUnlock: some View {
        Button {
            Task { await lock.unlockWithDevice(reason: T.unlockReason) }
        } label: {
            Label(T.unlockReason, systemImage: biometryIcon)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
    }

    private var biometryIcon: String {
        switch lock.biometryKind {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        case .opticID: return "opticid"
        case .none: return "lock.open"
        }
    }

    // MARK: Clef maîtresse

    @ViewBuilder
    private var masterKeyUnlock: some View {
        if lock.hasMasterKey {
            Text(T.t("Saisissez votre clef maîtresse", "Enter your master key"))
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            SecureField(T.t("Clef maîtresse", "Master key"), text: $typedKey)
                .modifier(VaultSecretFieldStyle())
                .onSubmit(unlockWithMasterKey)

            Button(action: unlockWithMasterKey) {
                Text(T.unlockReason).frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(typedKey.isEmpty)
        } else {
            Text(T.message(.noMasterKey))
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func unlockWithMasterKey() {
        guard !typedKey.isEmpty else { return }
        if lock.unlock(masterKey: typedKey) { typedKey = "" }
    }

    /// Ouvre l'invite d'elle-même à l'arrivée sur l'écran : pas un bouton de
    /// plus à chercher. Une seule fois par affichage : annuler laisse le
    /// bouton, sans relancer l'invite.
    private func promptOnce() {
        guard !autoPrompted, lock.phase == .locked, lock.method == .device else { return }
        #if os(iOS)
        // L'OS refuse l'invite tant que l'app n'est pas au premier plan ; le
        // changement de scenePhase rappellera.
        guard scenePhase == .active else { return }
        #elseif os(macOS)
        // Verrouillé pendant que l'app était derrière : on attend son retour
        // au premier plan (scenePhase rappellera).
        guard NSApplication.shared.isActive else { return }
        #endif
        autoPrompted = true
        Task {
            // Laisse la feuille finir d'apparaître : une invite ouverte pendant
            // l'animation est annulée d'office sur macOS.
            try? await Task.sleep(nanoseconds: 300_000_000)
            await lock.unlockWithDevice(reason: T.unlockReason)
        }
    }
}

/// Champ de la clef, même rendu sur les deux plateformes. Pas de
/// `textContentType` : le système proposerait d'enregistrer ou de générer
/// cette saisie, qui doit rester propre à cet appareil.
private struct VaultSecretFieldStyle: ViewModifier {

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
