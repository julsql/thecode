//
//  VaultLockTests.swift
//  Verrou du carnet : authentification de l'appareil, ou clef maîtresse sur un
//  appareil qui n'en a aucune.
//

import Foundation
import Testing

@testable import TheCode

// MARK: - Doublures

private final class FakeDeviceAuth: VaultDeviceAuth {
    var isAvailable: Bool
    var biometryKind: VaultBiometryKind
    var succeeds: Bool
    private(set) var prompts = 0

    init(available: Bool = true, kind: VaultBiometryKind = .faceID, succeeds: Bool = true) {
        self.isAvailable = available
        self.biometryKind = kind
        self.succeeds = succeeds
    }

    func authenticate(reason: String) async -> Bool {
        prompts += 1
        return succeeds
    }
}

/// Clef maîtresse enregistrée sur l'appareil, en mémoire.
private final class FakeKeyStore {
    var key = "correct horse battery staple"
}

/// Session commune clef + carnet, en mémoire.
private final class MemorySessionStore: VaultSessionStore {
    var stampedAt: TimeInterval?
    func loadStampedAt() -> TimeInterval? { stampedAt }
    func stamp(at instant: TimeInterval) { stampedAt = instant }
    func invalidate() { stampedAt = nil }
}

/// Horloge réglable à la main.
private final class FakeClock {
    var now: TimeInterval = 1_000_000
}

@MainActor
private func makeLock(
    device: FakeDeviceAuth = FakeDeviceAuth(),
    keys: FakeKeyStore = FakeKeyStore(),
    session: MemorySessionStore = MemorySessionStore(),
    clock: FakeClock = FakeClock()
) -> VaultLockController {
    VaultLockController(
        deviceAuth: device, masterKey: { keys.key }, session: session, now: { clock.now })
}

// MARK: - Clef maîtresse

@Suite("Verrou du carnet — comparaison de la clef maîtresse")
struct VaultMasterKeyCheckTests {

    @Test("Même clef acceptée, autre clef refusée")
    func matches() {
        #expect(VaultMasterKeyCheck.matches("abc", stored: "abc"))
        #expect(!VaultMasterKeyCheck.matches("abd", stored: "abc"))
        #expect(!VaultMasterKeyCheck.matches("ab", stored: "abc"))
        #expect(!VaultMasterKeyCheck.matches("abcd", stored: "abc"))
        #expect(!VaultMasterKeyCheck.matches("ABC", stored: "abc"))
    }

    @Test("Aucune clef enregistrée : rien ne correspond, pas même une saisie vide")
    func emptyStored() {
        #expect(!VaultMasterKeyCheck.matches("", stored: ""))
        #expect(!VaultMasterKeyCheck.matches("abc", stored: ""))
    }

    @Test("Comparaison en temps constant : longueurs et contenus")
    func constantTimeEquals() {
        #expect(VaultMasterKeyCheck.constantTimeEquals(Data([1, 2, 3]), Data([1, 2, 3])))
        #expect(!VaultMasterKeyCheck.constantTimeEquals(Data([1, 2, 3]), Data([1, 2, 4])))
        #expect(!VaultMasterKeyCheck.constantTimeEquals(Data([1, 2]), Data([1, 2, 3])))
    }
}

// MARK: - Contrôleur

@Suite("Verrou du carnet — déverrouillage")
@MainActor
struct VaultLockControllerTests {

    @Test("Appareil avec authentification : méthode appareil, verrouillé à l'ouverture")
    func deviceMethod() {
        let lock = makeLock()
        #expect(lock.method == .device)
        #expect(lock.phase == .locked)
        #expect(lock.biometryKind == .faceID)
    }

    @Test("Appareil sans aucune authentification : méthode clef maîtresse")
    func masterKeyMethod() {
        let lock = makeLock(device: FakeDeviceAuth(available: false, kind: .none))
        #expect(lock.method == .masterKey)
        #expect(lock.hasMasterKey)
    }

    @Test("Authentification de l'appareil réussie : déverrouillé")
    func unlockWithDevice() async {
        let device = FakeDeviceAuth()
        let lock = makeLock(device: device)
        #expect(await lock.unlockWithDevice(reason: "test"))
        #expect(lock.phase == .unlocked)
        #expect(device.prompts == 1)
        #expect(lock.error == nil)
    }

    @Test("Authentification de l'appareil refusée : reste verrouillé")
    func unlockWithDeviceFails() async {
        let lock = makeLock(device: FakeDeviceAuth(succeeds: false))
        #expect(await lock.unlockWithDevice(reason: "test") == false)
        #expect(lock.phase == .locked)
        #expect(lock.error == .deviceAuthFailed)
    }

    @Test("Code retiré entre-temps : pas d'invite, bascule sur la clef maîtresse")
    func deviceAuthRemoved() async {
        let device = FakeDeviceAuth()
        let lock = makeLock(device: device)
        device.isAvailable = false
        #expect(await lock.unlockWithDevice(reason: "test") == false)
        #expect(device.prompts == 0)
        #expect(lock.method == .masterKey)
    }

    @Test("Avec une authentification sur l'appareil, la clef maîtresse n'ouvre pas")
    func masterKeyRefusedWhenDeviceAuthExists() {
        let keys = FakeKeyStore()
        let lock = makeLock(keys: keys)
        #expect(lock.unlock(masterKey: keys.key) == false)
        #expect(lock.phase == .locked)
    }

    @Test("Sans authentification sur l'appareil, pas d'invite système")
    func noDevicePromptWithoutDeviceAuth() async {
        let device = FakeDeviceAuth(available: false)
        let lock = makeLock(device: device)
        #expect(await lock.unlockWithDevice(reason: "test") == false)
        #expect(device.prompts == 0)
    }

    @Test("Bonne clef maîtresse : déverrouillé")
    func unlockWithMasterKey() {
        let keys = FakeKeyStore()
        let lock = makeLock(device: FakeDeviceAuth(available: false), keys: keys)
        #expect(lock.unlock(masterKey: keys.key))
        #expect(lock.phase == .unlocked)
        #expect(lock.error == nil)
    }

    @Test("Mauvaise clef maîtresse : refusée")
    func wrongMasterKey() {
        let lock = makeLock(device: FakeDeviceAuth(available: false))
        #expect(lock.unlock(masterKey: "autre chose") == false)
        #expect(lock.phase == .locked)
        #expect(lock.error == .wrongMasterKey)
    }

    @Test("Aucune clef maîtresse enregistrée : rien n'ouvre, on renvoie à l'écran principal")
    func noMasterKey() {
        let keys = FakeKeyStore()
        keys.key = ""
        let lock = makeLock(device: FakeDeviceAuth(available: false), keys: keys)
        #expect(lock.hasMasterKey == false)
        #expect(lock.unlock(masterKey: "") == false)
        #expect(lock.unlock(masterKey: "n'importe quoi") == false)
        #expect(lock.error == .noMasterKey)
        #expect(lock.phase == .locked)
    }

    @Test("Clef maîtresse posée depuis l'écran principal : prise en compte au retour")
    func masterKeySetLater() {
        let keys = FakeKeyStore()
        keys.key = ""
        let lock = makeLock(device: FakeDeviceAuth(available: false), keys: keys)
        #expect(lock.hasMasterKey == false)

        keys.key = "nouvelle"
        lock.resume()
        #expect(lock.hasMasterKey)
        #expect(lock.unlock(masterKey: "nouvelle"))
    }

    @Test("Code posé sur l'appareil : le retour repasse à l'authentification de l'appareil")
    func deviceAuthAddedLater() {
        let device = FakeDeviceAuth(available: false)
        let lock = makeLock(device: device)
        #expect(lock.method == .masterKey)

        device.isAvailable = true
        lock.resume()
        #expect(lock.method == .device)
    }

    @Test("Déjà déverrouillé : un second déverrouillage ne redemande rien")
    func alreadyUnlocked() async {
        let device = FakeDeviceAuth()
        let lock = makeLock(device: device)
        _ = await lock.unlockWithDevice(reason: "test")
        #expect(await lock.unlockWithDevice(reason: "test") == false)
        #expect(device.prompts == 1)
    }

    @Test("Une nouvelle présentation sans session repart verrouillée")
    func reopensLocked() async {
        let lock = makeLock()
        _ = await lock.unlockWithDevice(reason: "test")
        #expect(makeLock().phase == .locked)
    }
}

// MARK: - Session

@Suite("Verrou du carnet — session commune avec la clef")
@MainActor
struct VaultSessionTests {

    @Test("Logique pure : dans la grâce, au-delà, sans horodatage, horloge reculée")
    func pureLogic() {
        #expect(VaultSession.isOpen(stampedAt: 1_000, now: 1_000))
        #expect(VaultSession.isOpen(stampedAt: 1_000, now: 1_000 + 180))
        #expect(!VaultSession.isOpen(stampedAt: 1_000, now: 1_000 + 181))
        #expect(!VaultSession.isOpen(stampedAt: nil, now: 1_000))
        #expect(!VaultSession.isOpen(stampedAt: 1_000, now: 999))
        #expect(!VaultSession.isOpen(stampedAt: 0, now: 10))
    }

    /// Un carnet déverrouillé par l'appareil.
    private func unlocked(
        _ session: MemorySessionStore, _ clock: FakeClock
    ) async -> VaultLockController {
        let lock = makeLock(session: session, clock: clock)
        _ = await lock.unlockWithDevice(reason: "test")
        return lock
    }

    @Test("Clef déverrouillée depuis moins de 3 minutes : le carnet s'ouvre sans rien demander")
    func keySessionOpensTheVault() {
        let (session, clock, device) = (MemorySessionStore(), FakeClock(), FakeDeviceAuth())
        session.stampedAt = clock.now - 120

        #expect(makeLock(device: device, session: session, clock: clock).phase == .unlocked)
        #expect(device.prompts == 0)
    }

    @Test("Clef déverrouillée il y a plus de 3 minutes : le carnet demande")
    func expiredKeySessionKeepsTheVaultLocked() {
        let (session, clock) = (MemorySessionStore(), FakeClock())
        session.stampedAt = clock.now - 181

        #expect(makeLock(session: session, clock: clock).phase == .locked)
    }

    @Test("Déverrouiller le carnet par l'appareil ouvre la session de la clef")
    func deviceUnlockStampsTheSession() async {
        let (session, clock) = (MemorySessionStore(), FakeClock())
        let failing = makeLock(
            device: FakeDeviceAuth(succeeds: false), session: session, clock: clock)
        #expect(await failing.unlockWithDevice(reason: "test") == false)
        #expect(session.stampedAt == nil)

        let lock = makeLock(session: session, clock: clock)
        #expect(await lock.unlockWithDevice(reason: "test"))
        #expect(session.stampedAt == clock.now)
    }

    @Test("Déverrouiller le carnet par la clef maîtresse ouvre la session de la clef")
    func masterKeyUnlockStampsTheSession() {
        let (session, clock, keys) = (MemorySessionStore(), FakeClock(), FakeKeyStore())
        let lock = makeLock(
            device: FakeDeviceAuth(available: false), keys: keys, session: session, clock: clock)

        #expect(lock.unlock(masterKey: "faux") == false)
        #expect(session.stampedAt == nil)

        #expect(lock.unlock(masterKey: keys.key))
        #expect(session.stampedAt == clock.now)
    }

    @Test("Quitter l'écran déverrouillé fait courir la fenêtre sans verrouiller")
    func leavingDoesNotLock() async {
        let (session, clock) = (MemorySessionStore(), FakeClock())
        let lock = await unlocked(session, clock)

        clock.now += 60
        lock.leave()
        #expect(lock.isUnlocked)
        #expect(session.stampedAt == clock.now)
    }

    @Test("Quitter verrouillé ne touche pas la session de la clef")
    func leavingLockedKeepsTheSession() {
        let (session, clock) = (MemorySessionStore(), FakeClock())
        let lock = makeLock(session: session, clock: clock)

        lock.leave()
        #expect(session.stampedAt == nil)

        session.stampedAt = clock.now - 200
        lock.leave()
        #expect(session.stampedAt == clock.now - 200)
    }

    @Test("Rouvrir la feuille dans les 3 minutes : toujours déverrouillé")
    func reopenWithinGrace() async {
        let (session, clock) = (MemorySessionStore(), FakeClock())
        let first = await unlocked(session, clock)
        first.leave()

        clock.now += 180
        let second = makeLock(session: session, clock: clock)
        #expect(second.phase == .unlocked)

        second.resume()
        #expect(second.isUnlocked)
    }

    @Test("Rouvrir la feuille après 3 minutes : verrouillé")
    func reopenAfterGrace() async {
        let (session, clock) = (MemorySessionStore(), FakeClock())
        let first = await unlocked(session, clock)
        first.leave()

        clock.now += 181
        #expect(makeLock(session: session, clock: clock).phase == .locked)
    }

    @Test("Retour au premier plan : ouvert dans la grâce (la fenêtre repart), verrouillé au-delà")
    func resumeFromBackground() async {
        let (session, clock) = (MemorySessionStore(), FakeClock())
        let lock = await unlocked(session, clock)

        lock.leave()
        clock.now += 60
        lock.resume()
        #expect(lock.phase == .unlocked)
        #expect(session.stampedAt == clock.now)

        lock.leave()
        clock.now += 181
        lock.resume()
        #expect(lock.phase == .locked)
    }

    @Test("Retour au premier plan verrouillé, clef déverrouillée entre-temps : ouvert")
    func resumeOpensWhenTheKeyWasUnlocked() {
        let (session, clock) = (MemorySessionStore(), FakeClock())
        let lock = makeLock(session: session, clock: clock)

        lock.resume()
        #expect(lock.phase == .locked)

        session.stampedAt = clock.now
        lock.resume()
        #expect(lock.phase == .unlocked)
    }

    @Test("Horloge reculée : verrouillé")
    func clockGoingBackwards() async {
        let (session, clock) = (MemorySessionStore(), FakeClock())
        let lock = await unlocked(session, clock)

        lock.leave()
        clock.now -= 1
        lock.resume()
        #expect(lock.phase == .locked)

        session.stampedAt = clock.now + 30
        #expect(makeLock(session: session, clock: clock).phase == .locked)
    }

    @Test("Resté sur l'écran sans le quitter : rien ne change")
    func resumeWithoutLeaving() async {
        let (session, clock) = (MemorySessionStore(), FakeClock())
        let lock = await unlocked(session, clock)

        clock.now += 3_600
        lock.resume()
        #expect(lock.isUnlocked)
    }

    @Test("Verrouiller ferme la session, clef comprise")
    func lockEndsTheSession() async {
        let (session, clock) = (MemorySessionStore(), FakeClock())
        let lock = await unlocked(session, clock)
        lock.leave()

        lock.lock()
        #expect(lock.phase == .locked)
        #expect(session.stampedAt == nil)
        #expect(makeLock(session: session, clock: clock).phase == .locked)
    }

    @Test("Reprise dans la grâce : aucune invite de l'appareil")
    func resumeWithoutPrompt() async {
        let (session, clock, device) = (MemorySessionStore(), FakeClock(), FakeDeviceAuth())
        let first = makeLock(device: device, session: session, clock: clock)
        _ = await first.unlockWithDevice(reason: "test")
        first.leave()

        clock.now += 90
        let second = makeLock(device: device, session: session, clock: clock)
        #expect(second.phase == .unlocked)
        #expect(device.prompts == 1)
    }
}
