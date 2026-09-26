//
//  VaultLock.swift
//  Shared (TheCode iOS / TheCode for Mac)
//
//  Verrou de l'écran carnet.
//
//  Le verrou protège l'écran de gestion, pas les données : le remplissage
//  automatique et la génération continuent de lire le carnet sans rien
//  demander. Il n'a aucun secret propre : le carnet s'ouvre avec
//  l'authentification de l'appareil (Face ID / Touch ID, avec le code de
//  l'appareil ou le mot de passe du Mac en repli), ou, sur un appareil qui n'en
//  a aucune, en ressaisissant la clef maîtresse.
//
//  Toute la logique vit ici, sans vue ni chaîne affichée, pour être vérifiable
//  avec une authentification, une clef et une session factices.
//

import Combine
import CryptoKit
import Foundation
import LocalAuthentication
import Security

// MARK: - Modèle

/// Comment le carnet s'ouvre sur cet appareil. Rien à choisir : cela dépend
/// seulement de ce que l'appareil sait faire.
nonisolated enum VaultUnlockMethod: Equatable, Sendable {
    /// Biométrie, avec le code de l'appareil (ou le mot de passe du Mac) en
    /// repli : `LAPolicy.deviceOwnerAuthentication`.
    case device
    /// Aucune authentification sur l'appareil : ressaisie de la clef maîtresse.
    case masterKey
}

/// Ce qui peut empêcher un déverrouillage. Les messages affichés sont
/// l'affaire des vues : ce fichier n'en contient aucun.
nonisolated enum VaultLockError: Error, Equatable, Sendable {
    case deviceAuthFailed
    case wrongMasterKey
    case noMasterKey
}

/// Type de biométrie offert par l'appareil, pour choisir la bonne icône.
nonisolated enum VaultBiometryKind: Equatable, Sendable {
    case none
    case faceID
    case touchID
    case opticID
}

// MARK: - Clef maîtresse

nonisolated enum VaultMasterKeyCheck {
    /// Compare la saisie à la clef stockée en temps constant : les deux sont
    /// d'abord ramenées à une empreinte SHA-256 de même taille, puis tous les
    /// octets sont parcourus. Le temps de réponse ne dit rien ni de la
    /// longueur de la clef ni de la position de la première différence.
    static func matches(_ typed: String, stored: String) -> Bool {
        guard !stored.isEmpty else { return false }
        return constantTimeEquals(
            Data(SHA256.hash(data: Data(typed.utf8))),
            Data(SHA256.hash(data: Data(stored.utf8))))
    }

    static func constantTimeEquals(_ lhs: Data, _ rhs: Data) -> Bool {
        guard lhs.count == rhs.count else { return false }
        var difference: UInt8 = 0
        for (a, b) in zip(lhs, rhs) { difference |= a ^ b }
        return difference == 0
    }
}

// MARK: - Anciens enregistrements

/// Méthode choisie et empreinte du mot de passe de carnet, écrites par la
/// version précédente du verrou. Plus rien ne les lit : on les retire du
/// trousseau au lancement.
nonisolated enum LegacyVaultLockRecords {
    static let service = "fr.julsql.thecode"
    static let accounts = ["vaultLockMethod", "vaultLockPassword"]

    static func remove() {
        for account in accounts {
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: account,
                kSecUseDataProtectionKeychain as String: true,
            ]
            SecItemDelete(query as CFDictionary)
        }
    }
}

// MARK: - Session

/// La session partagée avec la clef : déverrouiller l'un ouvre l'autre, et la
/// fenêtre de 3 minutes est commune. Ce n'est qu'un horodatage, aucun secret.
/// Abstrait pour les tests.
protocol VaultSessionStore {
    /// Dernier horodatage de la session, `nil` si aucune.
    func loadStampedAt() -> TimeInterval?
    /// Déverrouillage, ou sortie de l'écran déverrouillé : la fenêtre repart.
    func stamp(at instant: TimeInterval)
    /// Verrouillage explicite : clef et carnet se referment.
    func invalidate()
}

/// La session de la clef elle-même (`SessionLock`), dans les UserDefaults du
/// groupe d'app : elle survit à la fermeture de la feuille comme à celle de
/// l'app.
struct KeySessionStore: VaultSessionStore {
    func loadStampedAt() -> TimeInterval? { SessionLock.stampedAt }
    func stamp(at instant: TimeInterval) { SessionLock.stamp(at: instant) }
    func invalidate() { SessionLock.invalidate() }
}

/// Logique pure de la session, sans stockage ni horloge.
enum VaultSession {
    /// Session encore dans la grâce de 3 minutes ? Pas d'horodatage, ou
    /// horloge reculée : verrouillé.
    static func isOpen(stampedAt: TimeInterval?, now: TimeInterval) -> Bool {
        guard let stampedAt else { return false }
        return SessionLock.isWithinGrace(stampedAt: stampedAt, now: now)
    }
}

// MARK: - Authentification de l'appareil

nonisolated protocol VaultDeviceAuth {
    /// L'appareil a au moins une authentification : biométrie, code ou mot
    /// de passe de session.
    var isAvailable: Bool { get }
    /// Biométrie disponible et enrôlée, ou `.none`.
    var biometryKind: VaultBiometryKind { get }
    /// Face ID / Touch ID, avec le code de l'appareil en repli comme l'OS.
    func authenticate(reason: String) async -> Bool
}

nonisolated struct SystemVaultDeviceAuth: VaultDeviceAuth {
    var isAvailable: Bool {
        LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
    }

    var biometryKind: VaultBiometryKind {
        let context = LAContext()
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        else { return .none }
        switch context.biometryType {
        case .faceID: return .faceID
        case .touchID: return .touchID
        case .opticID: return .opticID
        default: return .none
        }
    }

    func authenticate(reason: String) async -> Bool {
        let context = LAContext()
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil) else {
            return false
        }
        return (try? await context.evaluatePolicy(
            .deviceOwnerAuthentication, localizedReason: reason)) ?? false
    }
}

// MARK: - Contrôleur

/// État du verrou pour un passage sur l'écran carnet.
///
/// Une instance par présentation de l'écran. Le déverrouillage vit dans la
/// session partagée avec la clef (`VaultSessionStore`) : déverrouiller le
/// carnet la (re)démarre, quitter l'écran déverrouillé la fait courir
/// (`leave`), et une instance créée pendant qu'elle tient repart
/// déverrouillée, que la session vienne du carnet ou de la clef.
@MainActor
final class VaultLockController: ObservableObject {

    enum Phase: Equatable {
        case locked
        case unlocked
    }

    @Published private(set) var phase: Phase
    @Published private(set) var isBusy = false
    @Published var error: VaultLockError?
    /// Relu à chaque retour sur l'écran : un code a pu être posé ou retiré.
    @Published private(set) var method: VaultUnlockMethod
    @Published private(set) var biometryKind: VaultBiometryKind
    /// Faux tant qu'aucune clef maîtresse n'est enregistrée sur l'appareil.
    @Published private(set) var hasMasterKey: Bool

    private let deviceAuth: VaultDeviceAuth
    private let masterKey: () -> String
    private let session: VaultSessionStore
    private let now: () -> TimeInterval

    init(
        deviceAuth: VaultDeviceAuth = SystemVaultDeviceAuth(),
        masterKey: @escaping () -> String = { SecureKeyStore.read() },
        session: VaultSessionStore = KeySessionStore(),
        now: @escaping () -> TimeInterval = { Date().timeIntervalSince1970 }
    ) {
        self.deviceAuth = deviceAuth
        self.masterKey = masterKey
        self.session = session
        self.now = now
        self.method = deviceAuth.isAvailable ? .device : .masterKey
        self.biometryKind = deviceAuth.biometryKind
        self.hasMasterKey = !masterKey().isEmpty
        self.phase =
            VaultSession.isOpen(stampedAt: session.loadStampedAt(), now: now())
            ? .unlocked : .locked
    }

    var isUnlocked: Bool { phase == .unlocked }

    /// Quitté déverrouillé depuis le dernier `resume` : seul cas où le retour
    /// doit vérifier la fenêtre. Resté sur l'écran, rien n'expire.
    private var hasLeft = false

    // MARK: Session

    /// Verrouille tout de suite et ferme la session : la clef aussi.
    func lock() {
        session.invalidate()
        hasLeft = false
        phase = .locked
    }

    /// L'écran est quitté (fermé, app en arrière-plan ou sans le focus) :
    /// déverrouillé, la fenêtre de 3 minutes part de maintenant, comme pour la
    /// clef. Verrouillé, la session (celle de la clef) n'est pas touchée.
    func leave() {
        guard isUnlocked else { return }
        session.stamp(at: now())
        hasLeft = true
    }

    /// L'écran est de nouveau visible. Session valide : ouvert, et la fenêtre
    /// repart (la clef a pu être déverrouillée entre-temps). Revenu trop tard :
    /// verrouillé. Jamais quitté : rien ne change.
    func resume() {
        refreshCapabilities()
        let open = VaultSession.isOpen(stampedAt: session.loadStampedAt(), now: now())
        switch phase {
        case .unlocked:
            guard hasLeft else { return }
            hasLeft = false
            if open {
                session.stamp(at: now())
            } else {
                phase = .locked
            }
        case .locked:
            guard open, !isBusy else { return }
            session.stamp(at: now())
            error = nil
            phase = .unlocked
        }
    }

    /// Déverrouillage prouvé : la session commune démarre, la clef suit.
    private func openSession() {
        session.stamp(at: now())
        hasLeft = false
        error = nil
        phase = .unlocked
    }

    private func refreshCapabilities() {
        method = deviceAuth.isAvailable ? .device : .masterKey
        biometryKind = deviceAuth.biometryKind
        hasMasterKey = !masterKey().isEmpty
    }

    // MARK: Déverrouillage

    /// Face ID / Touch ID, code de l'appareil ou mot de passe du Mac.
    @discardableResult
    func unlockWithDevice(reason: String) async -> Bool {
        guard phase == .locked, method == .device, !isBusy else { return false }
        // Le code a pu être retiré depuis l'arrivée sur l'écran.
        guard deviceAuth.isAvailable else {
            refreshCapabilities()
            return false
        }
        isBusy = true
        let ok = await deviceAuth.authenticate(reason: reason)
        isBusy = false
        // L'écran a pu être verrouillé ou ouvert autrement pendant l'invite.
        guard phase == .locked else { return false }
        guard ok else {
            error = .deviceAuthFailed
            return false
        }
        openSession()
        return true
    }

    /// Seulement sur un appareil sans aucune authentification : la clef
    /// maîtresse ressaisie doit être celle enregistrée sur cet appareil.
    @discardableResult
    func unlock(masterKey typed: String) -> Bool {
        guard phase == .locked, method == .masterKey, !isBusy else { return false }
        let stored = masterKey()
        hasMasterKey = !stored.isEmpty
        guard hasMasterKey else {
            error = .noMasterKey
            return false
        }
        guard VaultMasterKeyCheck.matches(typed, stored: stored) else {
            error = .wrongMasterKey
            return false
        }
        openSession()
        return true
    }
}
