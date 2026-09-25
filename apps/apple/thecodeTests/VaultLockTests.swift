//
//  VaultLockTests.swift
//  Verrou du carnet : voir shared/spec/vault-lock.md.
//

import Foundation
import Testing

@testable import TheCode

// MARK: - Doublures

private final class MemoryLockStorage: VaultLockStorage {
    var method: VaultLockMethod?
    var record: VaultPasswordRecord?
    var failWrites = false

    func loadMethod() -> VaultLockMethod? { method }

    func saveMethod(_ method: VaultLockMethod?) -> Bool {
        guard !failWrites else { return false }
        self.method = method
        return true
    }

    func loadPasswordRecord() -> VaultPasswordRecord? { record }

    func savePasswordRecord(_ record: VaultPasswordRecord?) -> Bool {
        guard !failWrites else { return false }
        self.record = record
        return true
    }
}

private final class FakeBiometrics: VaultBiometrics {
    var kind: VaultBiometryKind
    var succeeds: Bool
    private(set) var prompts = 0

    init(kind: VaultBiometryKind = .faceID, succeeds: Bool = true) {
        self.kind = kind
        self.succeeds = succeeds
    }

    func authenticate(reason: String) async -> Bool {
        prompts += 1
        return succeeds
    }
}

/// Itérations réduites : la règle est la même, les tests restent rapides. Le
/// nombre réel est vérifié à part.
private let fastIterations = 1_000

@MainActor
private func makeLock(
    storage: MemoryLockStorage = MemoryLockStorage(),
    biometrics: FakeBiometrics = FakeBiometrics()
) -> VaultLockController {
    VaultLockController(storage: storage, biometrics: biometrics, iterations: fastIterations)
}

// MARK: - Empreinte

@Suite("Verrou du carnet — empreinte du mot de passe")
struct VaultPasswordHasherTests {

    @Test("Paramètres de la spec : PBKDF2-SHA256, 600 000 itérations, sel 16, clef 32")
    func specParameters() {
        #expect(VaultPasswordHasher.iterations == 600_000)
        #expect(VaultPasswordHasher.saltLength == 16)
        #expect(VaultPasswordHasher.keyLength == 32)
        #expect(VaultPasswordHasher.version == 1)
    }

    @Test("PBKDF2-HMAC-SHA256 conforme au vecteur RFC 7914 (passwd/salt, c = 1)")
    func rfcVector() {
        let derived = VaultPasswordHasher.derive(
            password: "passwd", salt: Data("salt".utf8), iterations: 1, length: 64)
        let hex = derived?.map { String(format: "%02x", $0) }.joined()
        #expect(
            hex == "55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc"
                + "49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783")
    }

    @Test("L'enregistrement suit le format { v, salt, hash } en base64url")
    func recordFormat() throws {
        let record = try #require(
            VaultPasswordHasher.makeRecord(password: "correct horse", iterations: fastIterations))
        #expect(record.v == 1)
        #expect(VaultPasswordHasher.data(base64url: record.salt)?.count == 16)
        #expect(VaultPasswordHasher.data(base64url: record.hash)?.count == 32)
        for value in [record.salt, record.hash] {
            #expect(!value.contains("=") && !value.contains("+") && !value.contains("/"))
        }

        let json = String(decoding: try JSONEncoder().encode(record), as: UTF8.self)
        #expect(json.contains("\"v\":1"))
    }

    @Test("Deux créations du même mot de passe n'ont pas le même sel")
    func freshSalt() throws {
        let a = try #require(VaultPasswordHasher.makeRecord(password: "abcdefgh", iterations: 1))
        let b = try #require(VaultPasswordHasher.makeRecord(password: "abcdefgh", iterations: 1))
        #expect(a.salt != b.salt)
        #expect(a.hash != b.hash)
    }

    @Test("Vérification : bon mot de passe accepté, mauvais refusé")
    func verify() throws {
        let record = try #require(
            VaultPasswordHasher.makeRecord(password: "motdepasse", iterations: fastIterations))
        #expect(VaultPasswordHasher.verify(
            password: "motdepasse", record: record, iterations: fastIterations))
        #expect(!VaultPasswordHasher.verify(
            password: "motdepassE", record: record, iterations: fastIterations))
    }

    @Test("Une version inconnue n'est jamais acceptée")
    func unknownVersion() throws {
        var record = try #require(
            VaultPasswordHasher.makeRecord(password: "motdepasse", iterations: fastIterations))
        record.v = 2
        #expect(!VaultPasswordHasher.verify(
            password: "motdepasse", record: record, iterations: fastIterations))
    }

    @Test("Comparaison en temps constant : longueurs et contenus")
    func constantTimeEquals() {
        #expect(VaultPasswordHasher.constantTimeEquals(Data([1, 2, 3]), Data([1, 2, 3])))
        #expect(!VaultPasswordHasher.constantTimeEquals(Data([1, 2, 3]), Data([1, 2, 4])))
        #expect(!VaultPasswordHasher.constantTimeEquals(Data([1, 2]), Data([1, 2, 3])))
    }

    @Test("Règle de saisie : 8 caractères minimum, deux saisies identiques")
    func policy() {
        #expect(VaultPasswordPolicy.validate("1234567", confirmation: "1234567") == .tooShort)
        #expect(VaultPasswordPolicy.validate("12345678", confirmation: "12345679") == .mismatch)
        #expect(VaultPasswordPolicy.validate("12345678", confirmation: "12345678") == nil)
        // Des caractères, pas des octets.
        #expect(VaultPasswordPolicy.validate("éééééééé", confirmation: "éééééééé") == nil)
    }
}

// MARK: - Contrôleur

@Suite("Verrou du carnet — parcours")
@MainActor
struct VaultLockControllerTests {

    @Test("Première ouverture : configuration, biométrie proposée si disponible")
    func firstOpening() {
        let lock = makeLock()
        #expect(lock.phase == .setup)
        #expect(lock.biometricsAvailable)

        let noBiometrics = makeLock(biometrics: FakeBiometrics(kind: .none))
        #expect(noBiometrics.phase == .setup)
        #expect(!noBiometrics.biometricsAvailable)
    }

    @Test("Choisir la biométrie : authentifie, retient la méthode, déverrouille")
    func chooseBiometrics() async {
        let storage = MemoryLockStorage()
        let lock = makeLock(storage: storage)
        #expect(await lock.chooseBiometrics(reason: "test"))
        #expect(lock.phase == .unlocked(.biometrics))
        #expect(storage.method == .biometrics)
        #expect(storage.record == nil)
    }

    @Test("Biométrie refusée : rien n'est retenu")
    func chooseBiometricsFails() async {
        let storage = MemoryLockStorage()
        let lock = makeLock(storage: storage, biometrics: FakeBiometrics(succeeds: false))
        #expect(await lock.chooseBiometrics(reason: "test") == false)
        #expect(lock.phase == .setup)
        #expect(lock.error == .biometricsFailed)
        #expect(storage.method == nil)
    }

    @Test("Sans biométrie, on ne peut pas la choisir")
    func biometricsUnavailable() async {
        let lock = makeLock(biometrics: FakeBiometrics(kind: .none))
        #expect(await lock.chooseBiometrics(reason: "test") == false)
        #expect(lock.error == .biometricsUnavailable)
    }

    @Test("Créer un mot de passe : jamais stocké en clair")
    func createPassword() async throws {
        let storage = MemoryLockStorage()
        let lock = makeLock(storage: storage)

        #expect(await lock.createPassword("court", confirmation: "court") == false)
        #expect(lock.error == .tooShort)
        #expect(await lock.createPassword("12345678", confirmation: "87654321") == false)
        #expect(lock.error == .mismatch)
        #expect(lock.phase == .setup)

        #expect(await lock.createPassword("12345678", confirmation: "12345678"))
        #expect(lock.phase == .unlocked(.password))
        #expect(lock.error == nil)
        #expect(storage.method == .password)
        let record = try #require(storage.record)
        #expect(!record.hash.contains("12345678") && !record.salt.contains("12345678"))
    }

    @Test("Une nouvelle présentation repart verrouillée")
    func reopensLocked() async {
        let storage = MemoryLockStorage()
        let first = makeLock(storage: storage)
        _ = await first.createPassword("12345678", confirmation: "12345678")

        #expect(makeLock(storage: storage).phase == .locked(.password))
    }

    @Test("Méthode mot de passe sans empreinte : retour à la configuration")
    func passwordMethodWithoutRecord() {
        let storage = MemoryLockStorage()
        storage.method = .password
        #expect(makeLock(storage: storage).phase == .setup)
    }

    @Test("Déverrouiller par mot de passe")
    func unlockWithPassword() async {
        let storage = MemoryLockStorage()
        _ = await makeLock(storage: storage).createPassword("12345678", confirmation: "12345678")
        let lock = makeLock(storage: storage)

        #expect(await lock.unlock(password: "00000000") == false)
        #expect(lock.error == .wrongPassword)
        #expect(lock.phase == .locked(.password))

        #expect(await lock.unlock(password: "12345678"))
        #expect(lock.phase == .unlocked(.password))
        #expect(lock.error == nil)
    }

    @Test("Déverrouiller par biométrie")
    func unlockWithBiometrics() async {
        let storage = MemoryLockStorage()
        storage.method = .biometrics
        let biometrics = FakeBiometrics(succeeds: false)
        let lock = makeLock(storage: storage, biometrics: biometrics)
        #expect(lock.phase == .locked(.biometrics))

        #expect(await lock.unlockWithBiometrics(reason: "test") == false)
        #expect(lock.phase == .locked(.biometrics))

        biometrics.succeeds = true
        #expect(await lock.unlockWithBiometrics(reason: "test"))
        #expect(lock.phase == .unlocked(.biometrics))
    }

    @Test("Reverrouiller garde la méthode")
    func relock() async {
        let lock = makeLock()
        _ = await lock.createPassword("12345678", confirmation: "12345678")
        lock.lock()
        #expect(lock.phase == .locked(.password))
        #expect(!lock.isUnlocked)

        // Sans effet hors session.
        lock.lock()
        #expect(lock.phase == .locked(.password))
    }

    @Test("Changer le mot de passe exige l'actuel")
    func changePassword() async {
        let storage = MemoryLockStorage()
        let lock = makeLock(storage: storage)
        _ = await lock.createPassword("ancien-mdp", confirmation: "ancien-mdp")
        let before = storage.record

        #expect(await lock.changePassword(
            current: "mauvais!", new: "nouveau-mdp", confirmation: "nouveau-mdp") == false)
        #expect(lock.error == .wrongPassword)
        #expect(storage.record == before)

        #expect(await lock.changePassword(
            current: "ancien-mdp", new: "nouveau-mdp", confirmation: "nouveau-mdp"))
        #expect(storage.record != before)

        let reopened = makeLock(storage: storage)
        #expect(await reopened.unlock(password: "ancien-mdp") == false)
        #expect(await reopened.unlock(password: "nouveau-mdp"))
    }

    @Test("Pas de changement de méthode tant que c'est verrouillé")
    func noChangeWhileLocked() async {
        let storage = MemoryLockStorage()
        _ = await makeLock(storage: storage).createPassword("12345678", confirmation: "12345678")
        let lock = makeLock(storage: storage)

        #expect(await lock.switchToBiometrics(reason: "test") == false)
        #expect(await lock.changePassword(
            current: "12345678", new: "abcdefgh", confirmation: "abcdefgh") == false)
        #expect(storage.method == .password)
    }

    @Test("Basculer mot de passe → biométrie efface l'empreinte")
    func switchToBiometrics() async {
        let storage = MemoryLockStorage()
        let lock = makeLock(storage: storage)
        _ = await lock.createPassword("12345678", confirmation: "12345678")

        #expect(await lock.switchToBiometrics(reason: "test"))
        #expect(lock.phase == .unlocked(.biometrics))
        #expect(storage.method == .biometrics)
        #expect(storage.record == nil)
    }

    @Test("Basculer biométrie → mot de passe")
    func switchToPassword() async {
        let storage = MemoryLockStorage()
        let lock = makeLock(storage: storage)
        _ = await lock.chooseBiometrics(reason: "test")

        #expect(await lock.switchToPassword("court", confirmation: "court") == false)
        #expect(await lock.switchToPassword("12345678", confirmation: "12345678"))
        #expect(lock.phase == .unlocked(.password))
        #expect(storage.method == .password)
        #expect(storage.record != nil)
    }

    @Test("Oubli : efface le carnet puis le verrou")
    func forget() async {
        let storage = MemoryLockStorage()
        _ = await makeLock(storage: storage).createPassword("12345678", confirmation: "12345678")
        let lock = makeLock(storage: storage)

        var wiped = false
        #expect(lock.forget(wipeVault: { wiped = true }))
        #expect(wiped)
        #expect(lock.phase == .setup)
        #expect(storage.method == nil)
        #expect(storage.record == nil)
    }

    @Test("Oubli : si l'effacement du carnet échoue, le verrou reste")
    func forgetKeepsLockWhenWipeFails() async {
        struct Failure: Error {}
        let storage = MemoryLockStorage()
        _ = await makeLock(storage: storage).createPassword("12345678", confirmation: "12345678")
        let lock = makeLock(storage: storage)

        #expect(lock.forget(wipeVault: { throw Failure() }) == false)
        #expect(lock.error == .wipeFailed)
        #expect(lock.phase == .locked(.password))
        #expect(storage.record != nil)
    }

    @Test("Échec du trousseau : pas de déverrouillage")
    func storageFailure() async {
        let storage = MemoryLockStorage()
        storage.failWrites = true
        let lock = makeLock(storage: storage)
        #expect(await lock.createPassword("12345678", confirmation: "12345678") == false)
        #expect(lock.error == .storageFailed)
        #expect(lock.phase == .setup)
    }

    @Test("Effacement du carnet local : fichier retiré, absence tolérée")
    func wipeLocalVault() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("vault-lock-\(UUID().uuidString).json")
        try Data("{}".utf8).write(to: url)

        try VaultLockController.wipeLocalVault(at: url)
        #expect(!FileManager.default.fileExists(atPath: url.path))
        try VaultLockController.wipeLocalVault(at: url)
        try VaultLockController.wipeLocalVault(at: nil)
    }
}
