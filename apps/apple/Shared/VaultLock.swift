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

/// Instant où l'on a quitté l'écran carnet déverrouillé. Sa présence vaut
/// « déverrouillé en partant » : on n'en écrit un que dans ce cas. Ce n'est
/// qu'un horodatage, aucun secret. Abstrait pour les tests.
protocol VaultSessionStore {
    func loadLeftAt() -> TimeInterval?
    func saveLeftAt(_ leftAt: TimeInterval?)
}

/// Dans les UserDefaults du groupe d'app, comme l'horodatage de la clef
/// (`SessionLock`) : la fenêtre survit à la fermeture de la feuille comme à
/// celle de l'app. Clef distincte : quitter le carnet ne prolonge pas la clef.
struct AppGroupVaultSessionStore: VaultSessionStore {
    private static let appGroupID = "group.fr.julsql.thecode.params"
    private static let key = "vaultLeftAt"

    private var store: UserDefaults? { UserDefaults(suiteName: Self.appGroupID) }

    func loadLeftAt() -> TimeInterval? {
        store?.object(forKey: Self.key) as? Double
    }

    func saveLeftAt(_ leftAt: TimeInterval?) {
        if let leftAt {
            store?.set(leftAt, forKey: Self.key)
        } else {
            store?.removeObject(forKey: Self.key)
        }
    }
}

/// Logique pure de la session, sans stockage ni horloge.
enum VaultSession {
    /// Revenu dans la grâce de la clef (3 minutes) après avoir quitté l'écran
    /// déverrouillé ? Pas d'horodatage, ou horloge reculée : verrouillé.
    static func resumesUnlocked(leftAt: TimeInterval?, now: TimeInterval) -> Bool {
        guard let leftAt else { return false }
        return SessionLock.isWithinGrace(stampedAt: leftAt, now: now)
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
/// Une instance par présentation de l'écran. Le déverrouillage survit
/// pourtant à sa fermeture : quitter l'écran déverrouillé horodate la sortie
/// (`leave`), et une instance créée dans les 3 minutes repart déverrouillée.
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
        session: VaultSessionStore = AppGroupVaultSessionStore(),
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
            VaultSession.resumesUnlocked(leftAt: session.loadLeftAt(), now: now())
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

    // MARK: Session

    /// Verrouille tout de suite et efface la fenêtre de grâce.
    func lock() {
        session.saveLeftAt(nil)
        if case .unlocked(let method) = phase { phase = .locked(method) }
    }

    /// L'écran est quitté (fermé, app en arrière-plan ou sans le focus) : on
    /// horodate la sortie sans verrouiller. Verrouillé, rien ne doit rouvrir.
    func leave() {
        session.saveLeftAt(isUnlocked ? now() : nil)
    }

    /// L'écran est de nouveau visible. Revenu dans les 3 minutes : toujours
    /// ouvert, et l'horodatage est consommé (il n'a plus lieu d'être tant
    /// qu'on y est). Au-delà : verrouillé. Jamais quitté : rien ne change.
    func resume() {
        guard case .unlocked(let method) = phase, let leftAt = session.loadLeftAt() else {
            return
        }
        session.saveLeftAt(nil)
        if !VaultSession.resumesUnlocked(leftAt: leftAt, now: now()) {
            phase = .locked(method)
        }
    }

    // MARK: Première ouverture

    @discardableResult
    func chooseBiometrics(reason: String) async -> Bool {
        guard case .setup = phase else { return false }
        return await enableBiometrics(reason: reason)
    }

    @discardableResult
    func createPassword(_ password: String, confirmation: String) async -> Bool {
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
        error = nil
        phase = .unlocked(.password)
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
        error = nil
        phase = .unlocked(.biometrics)
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
        session.saveLeftAt(nil)
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
        error = nil
        phase = .unlocked(.biometrics)
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
        error = nil
        phase = .unlocked(.password)
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
