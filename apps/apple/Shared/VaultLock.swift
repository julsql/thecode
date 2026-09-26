//
//  VaultLock.swift
//  Shared (TheCode iOS / TheCode for Mac)
//
//  Verrou de l'écran carnet : voir shared/spec/vault-lock.md.
//
//  Le verrou protège l'écran de gestion, pas les données : le remplissage
//  automatique et la génération continuent de lire le carnet sans rien
//  demander. Le choix de la méthode et le mot de passe restent sur l'appareil,
//  dans le trousseau, et ne sont jamais synchronisés.
//
//  Toute la logique vit ici, sans vue ni chaîne affichée, pour être vérifiable
//  avec un stockage et une biométrie factices.
//

import Combine
import CommonCrypto
import Foundation
import LocalAuthentication
import Security

// MARK: - Modèle

/// Méthode de déverrouillage choisie sur cet appareil.
nonisolated enum VaultLockMethod: String, Equatable, Sendable {
    case biometrics
    case password
}

/// Empreinte du mot de passe de carnet, telle que stockée.
///
/// `v = 1` fige l'algorithme : PBKDF2-SHA256, 600 000 itérations, 32 octets.
/// `salt` et `hash` sont en base64url sans remplissage.
nonisolated struct VaultPasswordRecord: Codable, Equatable, Sendable {
    var v: Int
    var salt: String
    var hash: String
}

/// Ce qui peut empêcher une opération du verrou. Les messages affichés sont
/// l'affaire des vues : ce fichier n'en contient aucun.
nonisolated enum VaultLockError: Error, Equatable, Sendable {
    case tooShort
    case mismatch
    case wrongPassword
    case biometricsFailed
    case biometricsUnavailable
    case storageFailed
    case wipeFailed
}

/// Type de biométrie offert par l'appareil, pour nommer le bon bouton.
nonisolated enum VaultBiometryKind: Equatable, Sendable {
    case none
    case faceID
    case touchID
    case opticID
}

// MARK: - Mot de passe

nonisolated enum VaultPasswordPolicy {
    static let minimumLength = 8

    /// Contrôle d'une création ou d'un changement : saisi deux fois, 8
    /// caractères au moins. La longueur se compte en caractères, pas en octets.
    static func validate(_ password: String, confirmation: String) -> VaultLockError? {
        if password.count < minimumLength { return .tooShort }
        if password != confirmation { return .mismatch }
        return nil
    }
}

nonisolated enum VaultPasswordHasher {
    static let version = 1
    static let iterations = 600_000
    static let saltLength = 16
    static let keyLength = 32

    /// PBKDF2-HMAC-SHA256 via CommonCrypto. `nil` si la dérivation échoue.
    ///
    /// Plusieurs centaines de millisecondes à 600 000 itérations : jamais sur
    /// le fil qui dessine l'écran.
    static func derive(
        password: String, salt: Data, iterations: Int, length: Int = keyLength
    ) -> Data? {
        let passwordBytes = Array(password.utf8)
        var derived = [UInt8](repeating: 0, count: length)
        let status = salt.withUnsafeBytes { saltBuffer -> Int32 in
            passwordBytes.withUnsafeBufferPointer { passwordBuffer -> Int32 in
                passwordBuffer.baseAddress!.withMemoryRebound(
                    to: CChar.self, capacity: passwordBytes.count
                ) { passwordPointer in
                    CCKeyDerivationPBKDF(
                        CCPBKDFAlgorithm(kCCPBKDF2),
                        passwordPointer, passwordBytes.count,
                        saltBuffer.bindMemory(to: UInt8.self).baseAddress, salt.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                        UInt32(iterations),
                        &derived, length)
                }
            }
        }
        return status == kCCSuccess ? Data(derived) : nil
    }

    static func randomSalt() -> Data? {
        var bytes = [UInt8](repeating: 0, count: saltLength)
        guard SecRandomCopyBytes(kSecRandomDefault, saltLength, &bytes) == errSecSuccess else {
            return nil
        }
        return Data(bytes)
    }

    /// Empreinte d'un nouveau mot de passe, avec un sel neuf.
    static func makeRecord(
        password: String, salt: Data? = nil, iterations: Int = iterations
    ) -> VaultPasswordRecord? {
        guard let salt = salt ?? randomSalt(),
              let hash = derive(password: password, salt: salt, iterations: iterations)
        else { return nil }
        return VaultPasswordRecord(
            v: version, salt: base64url(salt), hash: base64url(hash))
    }

    /// Vérifie une saisie contre l'empreinte stockée, en temps constant.
    static func verify(
        password: String, record: VaultPasswordRecord, iterations: Int = iterations
    ) -> Bool {
        guard record.v == version,
              let salt = data(base64url: record.salt),
              let expected = data(base64url: record.hash),
              let actual = derive(
                password: password, salt: salt, iterations: iterations,
                length: expected.count)
        else { return false }
        return constantTimeEquals(actual, expected)
    }

    /// Comparaison qui parcourt toujours tous les octets : le temps de réponse
    /// ne dit rien de la position de la première différence.
    static func constantTimeEquals(_ lhs: Data, _ rhs: Data) -> Bool {
        guard lhs.count == rhs.count else { return false }
        var difference: UInt8 = 0
        for (a, b) in zip(lhs, rhs) { difference |= a ^ b }
        return difference == 0
    }

    static func base64url(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func data(base64url: String) -> Data? {
        var base64 = base64url
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = base64.count % 4
        if remainder > 0 { base64 += String(repeating: "=", count: 4 - remainder) }
        return Data(base64Encoded: base64)
    }
}

// MARK: - Stockage

/// Où vivent la méthode et l'empreinte. Abstrait pour les tests.
nonisolated protocol VaultLockStorage {
    func loadMethod() -> VaultLockMethod?
    @discardableResult func saveMethod(_ method: VaultLockMethod?) -> Bool
    func loadPasswordRecord() -> VaultPasswordRecord?
    @discardableResult func savePasswordRecord(_ record: VaultPasswordRecord?) -> Bool
}

/// Stockage dans le trousseau, sur le modèle de `SecureKeyStore` : même
/// service, groupe d'accès implicite, lié à l'appareil et jamais sauvegardé
/// vers un autre.
nonisolated struct KeychainVaultLockStorage: VaultLockStorage {
    private let service = "fr.julsql.thecode"
    private let methodAccount = "vaultLockMethod"
    private let passwordAccount = "vaultLockPassword"

    func loadMethod() -> VaultLockMethod? {
        read(methodAccount).flatMap { String(data: $0, encoding: .utf8) }
            .flatMap(VaultLockMethod.init(rawValue:))
    }

    func saveMethod(_ method: VaultLockMethod?) -> Bool {
        write(methodAccount, method.map { Data($0.rawValue.utf8) })
    }

    func loadPasswordRecord() -> VaultPasswordRecord? {
        read(passwordAccount).flatMap { try? JSONDecoder().decode(VaultPasswordRecord.self, from: $0) }
    }

    func savePasswordRecord(_ record: VaultPasswordRecord?) -> Bool {
        guard let record else { return write(passwordAccount, nil) }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let data = try? encoder.encode(record) else { return false }
        return write(passwordAccount, data)
    }

    private func baseQuery(_ account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecUseDataProtectionKeychain as String: true,
        ]
    }

    private func read(_ account: String) -> Data? {
        var query = baseQuery(account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess else {
            return nil
        }
        return item as? Data
    }

    private func write(_ account: String, _ data: Data?) -> Bool {
        guard let data else {
            let status = SecItemDelete(baseQuery(account) as CFDictionary)
            return status == errSecSuccess || status == errSecItemNotFound
        }
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        let status = SecItemUpdate(baseQuery(account) as CFDictionary, attributes as CFDictionary)
        if status == errSecSuccess { return true }
        guard status == errSecItemNotFound else { return false }

        var insert = baseQuery(account)
        insert.merge(attributes) { _, new in new }
        return SecItemAdd(insert as CFDictionary, nil) == errSecSuccess
    }
}

// MARK: - Session

/// La session partagée avec la clef (voir « Apps : une seule session avec la
/// clef » dans vault-lock.md) : déverrouiller l'un ouvre l'autre, et la
/// fenêtre de 3 minutes est commune. Ce n'est qu'un horodatage, aucun secret.
/// Abstrait pour les tests.
protocol VaultSessionStore {
    /// Dernier horodatage de la session, `nil` si aucune.
    func loadStampedAt() -> TimeInterval?
    /// Déverrouillage, ou sortie de l'écran déverrouillé : la fenêtre repart.
    func stamp(at instant: TimeInterval)
    /// Verrouillage explicite ou oubli : clef et carnet se referment.
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

// MARK: - Biométrie

nonisolated protocol VaultBiometrics {
    /// Biométrie disponible et enrôlée, ou `.none`.
    var kind: VaultBiometryKind { get }
    /// Face ID / Touch ID, avec le code de l'appareil en repli comme l'OS.
    func authenticate(reason: String) async -> Bool
}

nonisolated struct SystemVaultBiometrics: VaultBiometrics {
    var kind: VaultBiometryKind {
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
/// déverrouillée, que la session vienne du carnet ou de la clef. Le verrou
/// propre au carnet ne sert qu'à défaut de session valide.
@MainActor
final class VaultLockController: ObservableObject {

    enum Phase: Equatable {
        /// Aucune méthode choisie : première ouverture, ou après un oubli.
        case setup
        case locked(VaultLockMethod)
        case unlocked(VaultLockMethod)
    }

    @Published private(set) var phase: Phase
    @Published private(set) var isBusy = false
    @Published var error: VaultLockError?

    let biometryKind: VaultBiometryKind

    private let storage: VaultLockStorage
    private let biometrics: VaultBiometrics
    private let iterations: Int
    private let session: VaultSessionStore
    private let now: () -> TimeInterval

    init(
        storage: VaultLockStorage = KeychainVaultLockStorage(),
        biometrics: VaultBiometrics = SystemVaultBiometrics(),
        iterations: Int = VaultPasswordHasher.iterations,
        session: VaultSessionStore = KeySessionStore(),
        now: @escaping () -> TimeInterval = { Date().timeIntervalSince1970 }
    ) {
        self.storage = storage
        self.biometrics = biometrics
        self.iterations = iterations
        self.session = session
        self.now = now
        self.biometryKind = biometrics.kind
        let initial = Self.initialPhase(storage)
        if case .locked(let method) = initial,
            VaultSession.isOpen(stampedAt: session.loadStampedAt(), now: now())
        {
            self.phase = .unlocked(method)
        } else {
            self.phase = initial
        }
    }

    var biometricsAvailable: Bool { biometryKind != .none }

    var isUnlocked: Bool {
        if case .unlocked = phase { return true }
        return false
    }

    /// Méthode en place, verrouillé ou non.
    var method: VaultLockMethod? {
        switch phase {
        case .setup: return nil
        case .locked(let method), .unlocked(let method): return method
        }
    }

    /// Une méthode « mot de passe » sans empreinte lisible ne protège rien :
    /// on repasse par la configuration plutôt que d'ouvrir sans rien demander.
    private static func initialPhase(_ storage: VaultLockStorage) -> Phase {
        switch storage.loadMethod() {
        case .biometrics: return .locked(.biometrics)
        case .password:
            return storage.loadPasswordRecord() == nil ? .setup : .locked(.password)
        case nil: return .setup
        }
    }

    /// Quitté déverrouillé depuis le dernier `resume` : seul cas où le retour
    /// doit vérifier la fenêtre. Resté sur l'écran, rien n'expire.
    private var hasLeft = false

    // MARK: Session

    /// Verrouille tout de suite et ferme la session : la clef aussi.
    func lock() {
        session.invalidate()
        hasLeft = false
        if case .unlocked(let method) = phase { phase = .locked(method) }
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
        let open = VaultSession.isOpen(stampedAt: session.loadStampedAt(), now: now())
        switch phase {
        case .unlocked(let method):
            guard hasLeft else { return }
            hasLeft = false
            if open {
                session.stamp(at: now())
            } else {
                phase = .locked(method)
            }
        case .locked(let method):
            guard open, !isBusy else { return }
            session.stamp(at: now())
            error = nil
            phase = .unlocked(method)
        case .setup:
            break
        }
    }

    /// Déverrouillage prouvé (biométrie, code de l'appareil ou mot de passe de
    /// carnet vérifié) : la session commune démarre, la clef suit.
    private func openSession(_ method: VaultLockMethod) {
        session.stamp(at: now())
        hasLeft = false
        error = nil
        phase = .unlocked(method)
    }

    // MARK: Première ouverture

    @discardableResult
    func chooseBiometrics(reason: String) async -> Bool {
        guard case .setup = phase else { return false }
        return await enableBiometrics(reason: reason)
    }

    /// Le mot de passe de carnet déverrouille aussi la clef : le poser sans
    /// session valide exige d'abord l'authentification de l'appareil, sinon un
    /// « Mot de passe oublié » suivi d'un nouveau mot de passe contournerait
    /// le verrou de la clef.
    @discardableResult
    func createPassword(_ password: String, confirmation: String, reason: String) async -> Bool {
        guard case .setup = phase else { return false }
        if let invalid = VaultPasswordPolicy.validate(password, confirmation: confirmation) {
            error = invalid
            return false
        }
        if !VaultSession.isOpen(stampedAt: session.loadStampedAt(), now: now()) {
            guard !isBusy else { return false }
            isBusy = true
            let ok = await biometrics.authenticate(reason: reason)
            isBusy = false
            guard ok else {
                error = .biometricsFailed
                return false
            }
        }
        guard case .setup = phase else { return false }
        return await storeNewPassword(password, confirmation: confirmation)
    }

    // MARK: Déverrouillage

    @discardableResult
    func unlock(password: String) async -> Bool {
        guard case .locked(.password) = phase, !isBusy else { return false }
        guard let record = storage.loadPasswordRecord() else {
            error = .storageFailed
            return false
        }
        isBusy = true
        let ok = await Self.verify(password, record, iterations)
        isBusy = false
        // L'écran a pu être reverrouillé ou oublié pendant le calcul.
        guard case .locked(.password) = phase else { return false }
        guard ok else {
            error = .wrongPassword
            return false
        }
        openSession(.password)
        return true
    }

    @discardableResult
    func unlockWithBiometrics(reason: String) async -> Bool {
        guard case .locked(.biometrics) = phase, !isBusy else { return false }
        isBusy = true
        let ok = await biometrics.authenticate(reason: reason)
        isBusy = false
        guard case .locked(.biometrics) = phase else { return false }
        guard ok else {
            error = .biometricsFailed
            return false
        }
        openSession(.biometrics)
        return true
    }

    // MARK: Changer de méthode (déverrouillé)

    @discardableResult
    func changePassword(current: String, new: String, confirmation: String) async -> Bool {
        guard case .unlocked(.password) = phase, !isBusy else { return false }
        if let invalid = VaultPasswordPolicy.validate(new, confirmation: confirmation) {
            error = invalid
            return false
        }
        guard let record = storage.loadPasswordRecord() else {
            error = .storageFailed
            return false
        }
        isBusy = true
        let ok = await Self.verify(current, record, iterations)
        isBusy = false
        guard ok else {
            error = .wrongPassword
            return false
        }
        return await storeNewPassword(new, confirmation: confirmation)
    }

    @discardableResult
    func switchToBiometrics(reason: String) async -> Bool {
        guard case .unlocked(.password) = phase else { return false }
        return await enableBiometrics(reason: reason)
    }

    @discardableResult
    func switchToPassword(_ password: String, confirmation: String) async -> Bool {
        guard case .unlocked(.biometrics) = phase else { return false }
        return await storeNewPassword(password, confirmation: confirmation)
    }

    // MARK: Oubli

    /// Efface le carnet local puis le verrou. Seule issue pour qui a perdu
    /// l'accès : rien d'autre ne passe le verrou.
    @discardableResult
    func forget(wipeVault: () throws -> Void) -> Bool {
        do {
            try wipeVault()
        } catch {
            self.error = .wipeFailed
            return false
        }
        storage.savePasswordRecord(nil)
        storage.saveMethod(nil)
        // Plus de verrou de carnet, plus de session : la clef se referme aussi.
        session.invalidate()
        hasLeft = false
        error = nil
        phase = .setup
        return true
    }

    /// Efface le fichier du carnet local. Absent, il n'y a rien à faire ; la
    /// synchronisation, si elle est active, le ramènera.
    static func wipeLocalVault() throws {
        try wipeLocalVault(at: VaultStore.url())
    }

    static func wipeLocalVault(at url: URL?) throws {
        guard let url, FileManager.default.fileExists(atPath: url.path) else { return }
        try FileManager.default.removeItem(at: url)
    }

    // MARK: Interne

    private func enableBiometrics(reason: String) async -> Bool {
        guard biometricsAvailable else {
            error = .biometricsUnavailable
            return false
        }
        guard !isBusy else { return false }
        isBusy = true
        let ok = await biometrics.authenticate(reason: reason)
        isBusy = false
        guard ok else {
            error = .biometricsFailed
            return false
        }
        guard storage.saveMethod(.biometrics) else {
            error = .storageFailed
            return false
        }
        // L'empreinte d'un ancien mot de passe n'a plus de raison d'exister.
        storage.savePasswordRecord(nil)
        openSession(.biometrics)
        return true
    }

    private func storeNewPassword(_ password: String, confirmation: String) async -> Bool {
        if let invalid = VaultPasswordPolicy.validate(password, confirmation: confirmation) {
            error = invalid
            return false
        }
        guard !isBusy else { return false }
        isBusy = true
        let iterations = self.iterations
        let record = await Task.detached(priority: .userInitiated) {
            VaultPasswordHasher.makeRecord(password: password, iterations: iterations)
        }.value
        isBusy = false
        guard let record, storage.savePasswordRecord(record), storage.saveMethod(.password)
        else {
            error = .storageFailed
            return false
        }
        openSession(.password)
        return true
    }

    private static func verify(
        _ password: String, _ record: VaultPasswordRecord, _ iterations: Int
    ) async -> Bool {
        await Task.detached(priority: .userInitiated) {
            VaultPasswordHasher.verify(password: password, record: record, iterations: iterations)
        }.value
    }
}
