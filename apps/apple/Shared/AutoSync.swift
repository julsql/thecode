//
//  AutoSync.swift
//  Synchronisation automatique du carnet puis des réglages par défaut.
//
//  Voir shared/spec/vault-sync.md, « Synchronisation automatique ». Les
//  déclencheurs (ouverture, écriture, réglage) viennent des écrans ; ici on
//  décide quand lancer, et on lance sans jamais bloquer l'écran : le résultat
//  n'est qu'une ligne d'état dans la zone de synchronisation du carnet.
//
//  Dans Shared pour servir aux deux apps. L'extension AutoFill n'a pas
//  d'ordonnanceur : après un enregistrement elle lance une passe, au mieux
//  (`syncAfterExtensionWrite`), et l'app rattrape à sa prochaine ouverture.
//

import Combine
import Foundation

/// Ce qui demande une synchronisation.
enum AutoSyncTrigger: Equatable {
    /// Lancement, retour au premier plan, ouverture du carnet : espacé.
    case open
    /// Entrée enregistrée, mise à jour, supprimée, renouvelée, importée.
    case write
    /// Réglage par défaut modifié.
    case settings
    /// Bouton « Synchroniser » : sans attente.
    case manual
}

/// La décision seule, sans horloge ni tâche : vérifiable à la main.
///
/// Regroupement de 2 s après le dernier déclencheur, jamais deux passes en
/// même temps, une seule relance mise de côté pendant une passe, et pas plus
/// d'une ouverture toutes les 30 s.
struct AutoSyncScheduler {

    static let debounce: TimeInterval = 2
    static let openInterval: TimeInterval = 30

    enum Action: Equatable {
        case none
        /// Attendre `delay` puis appeler `fire(ticket:)`.
        case wait(TimeInterval, ticket: Int)
        /// Lancer maintenant : la passe est déjà comptée comme en cours.
        case runNow
    }

    private(set) var isRunning = false
    private(set) var rerunQueued = false
    private(set) var pendingTicket: Int?
    private(set) var lastOpen: Date?
    private var tickets = 0

    mutating func request(_ trigger: AutoSyncTrigger, now: Date) -> Action {
        if trigger == .open {
            if let lastOpen, now.timeIntervalSince(lastOpen) < Self.openInterval {
                return .none
            }
            lastOpen = now
        }

        if isRunning {
            // Doubler la passe en cours pousserait sur une révision périmée ;
            // l'ignorer perdrait l'écriture qui vient d'arriver.
            rerunQueued = true
            return .none
        }

        if trigger == .manual {
            pendingTicket = nil
            isRunning = true
            return .runNow
        }

        return schedule()
    }

    /// L'attente est écoulée : vrai s'il faut lancer. Un ticket remplacé par un
    /// déclencheur plus récent ne lance rien.
    mutating func fire(ticket: Int) -> Bool {
        guard !isRunning, pendingTicket == ticket else { return false }
        pendingTicket = nil
        isRunning = true
        return true
    }

    /// La passe est finie : relance unique si quelque chose est arrivé entre-temps.
    mutating func finish() -> Action {
        isRunning = false
        guard rerunQueued else { return .none }
        rerunQueued = false
        return schedule()
    }

    private mutating func schedule() -> Action {
        tickets += 1
        pendingTicket = tickets
        return .wait(Self.debounce, ticket: tickets)
    }
}

/// Écriture locale qu'aucune synchronisation n'a encore portée sur le compte :
/// la passe a échoué, ou le processus s'est arrêté avant elle. Gardée dans le
/// groupe d'apps : l'extension AutoFill la pose, l'app la lit.
///
/// Un jeton plutôt qu'un booléen : une passe ne l'efface que s'il n'a pas
/// changé depuis son départ, sans quoi elle effacerait une écriture arrivée
/// pendant qu'elle tournait.
enum SyncPending {
    static let key = "syncPendingToken"

    static var shared: UserDefaults? { UserDefaults(suiteName: VaultStore.appGroupID) }

    static func mark(in defaults: UserDefaults? = shared) {
        defaults?.set(UUID().uuidString, forKey: key)
    }

    static func token(in defaults: UserDefaults? = shared) -> String? {
        defaults?.string(forKey: key)
    }

    static func clear(ifStill token: String?, in defaults: UserDefaults? = shared) {
        guard let token, defaults?.string(forKey: key) == token else { return }
        defaults?.removeObject(forKey: key)
    }
}

/// Une seule passe à la fois entre l'app et l'extension AutoFill, qui sont
/// deux processus : elles renouvellent le même jeton rotatif et écrivent le
/// même carnet.
///
/// Un fichier créé de façon exclusive, pas un verrou du noyau : iOS tue un
/// processus suspendu qui en tient un dans un conteneur partagé. Un bail
/// abandonné (processus arrêté en route) est repris une fois périmé.
struct SyncLease {
    static let filename = "sync.lease"
    /// Au-delà, le bail est tenu pour abandonné.
    static let staleAfter: TimeInterval = 25

    let url: URL

    /// Prend le bail, en attendant celui qui le tient. `nil` sans dossier
    /// partagé (rien à protéger) ou si la tâche est annulée.
    static func acquire(
        in directory: URL? = VaultStore.url()?.deletingLastPathComponent(),
        staleAfter: TimeInterval = SyncLease.staleAfter,
        poll: TimeInterval = 0.2
    ) async -> SyncLease? {
        guard let url = directory?.appendingPathComponent(filename) else { return nil }
        while !Task.isCancelled {
            let fd = open(url.path, O_CREAT | O_EXCL | O_WRONLY, 0o600)
            if fd >= 0 {
                close(fd)
                return SyncLease(url: url)
            }
            guard errno == EEXIST else { return nil }
            let taken =
                (try? FileManager.default.attributesOfItem(atPath: url.path))?[.modificationDate]
                as? Date
            if let taken, Date().timeIntervalSince(taken) < staleAfter {
                try? await Task.sleep(nanoseconds: UInt64(poll * 1_000_000_000))
            } else {
                // Périmé, ou disparu entre-temps : on retente aussitôt.
                try? FileManager.default.removeItem(at: url)
            }
        }
        return nil
    }

    func release() {
        try? FileManager.default.removeItem(at: url)
    }
}

#if os(iOS)
    /// Demande au système de ne pas suspendre le processus tant qu'une
    /// écriture attend sa synchronisation : enregistrer puis passer aussitôt
    /// à Safari ne doit pas laisser l'entrée sur le téléphone.
    final class ExpiringHold: @unchecked Sendable {
        private let done = DispatchSemaphore(value: 0)

        init(reason: String) {
            let done = self.done
            ProcessInfo.processInfo.performExpiringActivity(withReason: reason) { expired in
                // Temps écoulé : on libère le bloc en attente, le système
                // n'attendra pas plus.
                if expired { done.signal() } else { done.wait() }
            }
        }

        func release() { done.signal() }
    }
#endif

/// Lance la synchronisation pour tous les écrans, et garde son dernier état.
@MainActor
final class AutoSync: ObservableObject {

    static let shared = AutoSync()

    /// Dernier état, une phrase courte ; `nil` avant la première passe.
    @Published private(set) var status: String?
    @Published private(set) var isRunning = false
    /// Passes réussies : les écrans relisent carnet et réglages quand il bouge.
    @Published private(set) var completedRuns = 0

    typealias Perform = (_ masterKey: String, _ credentials: SyncCredentials) async throws
        -> Sync.Result

    private var scheduler = AutoSyncScheduler()
    private var timer: Task<Void, Never>?
    private let clock: () -> Date
    private let sleep: (TimeInterval) async -> Void
    private let credentials: () -> SyncCredentials?
    private let masterKey: () -> String
    private let perform: Perform
    private let isPending: () -> Bool
    private let markPending: () -> Void
    /// Le rattrapage à l'ouverture n'a pas encore été tenté depuis la
    /// dernière écriture (ou le lancement).
    private var pendingRetry = true
    #if os(iOS)
        private var hold: ExpiringHold?
    #endif

    init(
        clock: @escaping () -> Date = Date.init,
        sleep: @escaping (TimeInterval) async -> Void = { delay in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
        },
        credentials: @escaping () -> SyncCredentials? = { SyncCredentialsStore.load() },
        masterKey: @escaping () -> String = { SecureKeyStore.read() },
        perform: @escaping Perform = { key, creds in
            try await AutoSync.syncEverything(masterKey: key, credentials: creds)
        },
        isPending: @escaping () -> Bool = { SyncPending.token() != nil },
        markPending: @escaping () -> Void = { SyncPending.mark() }
    ) {
        self.isPending = isPending
        self.markPending = markPending
        self.clock = clock
        self.sleep = sleep
        self.credentials = credentials
        self.masterKey = masterKey
        self.perform = perform
    }

    /// Sans compte lié rien n'a où aller ; sans clef maîtresse rien ne peut
    /// être chiffré.
    nonisolated static func isEligible(credentials: SyncCredentials?, masterKey: String) -> Bool {
        credentials != nil && !masterKey.isEmpty
    }

    /// Demande une synchronisation ; ignorée quand elle ne peut pas partir.
    func request(_ trigger: AutoSyncTrigger) {
        // Notée avant de savoir si elle peut partir : sans clef ou sans
        // réseau, c'est ce qui la fera partir à la prochaine ouverture.
        if trigger == .write {
            markPending()
            pendingRetry = true
        }
        guard Self.isEligible(credentials: credentials(), masterKey: masterKey()) else { return }

        #if os(iOS)
            if trigger != .open, hold == nil { hold = ExpiringHold(reason: "thecode.sync") }
        #endif
        var action = scheduler.request(trigger, now: clock())
        // Une écriture restée sur l'appareil n'attend pas l'espacement des
        // ouvertures. Une seule fois par écriture : un échec qui dure
        // (plafond, hors ligne) ne relance pas une passe à chaque écran.
        if trigger == .open, action == .none, !scheduler.isRunning, pendingRetry, isPending() {
            pendingRetry = false
            action = scheduler.request(.write, now: clock())
        }
        handle(action)
        releaseHoldIfIdle()
    }

    /// Plus rien n'attend ni ne tourne : le système peut suspendre l'app.
    private func releaseHoldIfIdle() {
        #if os(iOS)
            guard !scheduler.isRunning, scheduler.pendingTicket == nil else { return }
            hold?.release()
            hold = nil
        #endif
    }

    /// Le bouton « Synchroniser ».
    func syncNow() { request(.manual) }

    /// Compte déconnecté : l'état d'avant ne veut plus rien dire.
    func reset() { status = nil }

    /// Déconnexion : révoque la session au mieux, puis oublie les jetons
    /// localement, que le service ait répondu ou non.
    nonisolated static func signOut(
        credentials: SyncCredentials?, sync: Sync = Sync(), forget: () -> Void
    ) async {
        if let credentials { await sync.logout(credentials: credentials) }
        forget()
    }

    /// Suppression du compte : le service d'abord, puis l'oubli des jetons
    /// comme une déconnexion. Seulement si le service a accepté : sur un
    /// refus, le compte existe toujours et l'appareil doit rester lié. Le
    /// carnet local n'est pas touché.
    nonisolated static func deleteAccount(
        credentials: SyncCredentials, confirmEmail: String, password: String,
        sync: Sync = Sync(), forget: () -> Void
    ) async throws {
        try await sync.deleteAccount(
            credentials: credentials, confirmEmail: confirmEmail, password: password)
        forget()
    }

    /// Pourquoi la suppression a échoué, pour le dire sous le bon champ.
    enum DeleteFailure: Equatable {
        /// 403 : le mot de passe du compte ne correspond pas.
        case wrongPassword
        /// 400 : l'adresse recopiée n'est pas celle du compte.
        case emailMismatch
        /// Tout le reste, avec de quoi le dire.
        case other(String)

        var message: String {
            switch self {
            case .wrongPassword:
                return L10nSync.t("Mot de passe incorrect.", "Wrong password.")
            case .emailMismatch:
                return L10nSync.t(
                    "Cette adresse ne correspond pas à celle du compte.",
                    "This email does not match the account.")
            case .other(let message):
                return message
            }
        }
    }

    nonisolated static func deleteFailure(_ error: Error) -> DeleteFailure {
        guard let syncError = error as? SyncError else {
            return .other(
                L10nSync.t(
                    "Le compte n'a pas été supprimé : \(error.localizedDescription)",
                    "The account was not deleted: \(error.localizedDescription)"))
        }
        switch syncError.status {
        case 403: return .wrongPassword
        case 400: return .emailMismatch
        case 0:
            return .other(
                L10nSync.t(
                    "Service injoignable : le compte n'a pas été supprimé. Réessayez plus tard.",
                    "The service cannot be reached: the account was not deleted. "
                        + "Try again later."))
        default:
            return .other(
                L10nSync.t(
                    "Le compte n'a pas été supprimé : \(syncError.message)",
                    "The account was not deleted: \(syncError.message)"))
        }
    }

    private func handle(_ action: AutoSyncScheduler.Action) {
        switch action {
        case .none:
            break
        case .runNow:
            start()
        case .wait(let delay, let ticket):
            timer?.cancel()
            let sleep = self.sleep
            timer = Task { [weak self] in
                await sleep(delay)
                guard let self, !Task.isCancelled else { return }
                if self.scheduler.fire(ticket: ticket) { self.start() }
            }
        }
    }

    private func start() {
        let key = masterKey()
        guard let creds = credentials(), Self.isEligible(credentials: creds, masterKey: key)
        else {
            handle(scheduler.finish())
            releaseHoldIfIdle()
            return
        }

        isRunning = true
        status = L10nSync.t("Synchronisation…", "Syncing…")
        let perform = self.perform

        Task { [weak self] in
            let message: String
            var succeeded = false
            do {
                message = Self.successMessage(try await perform(key, creds))
                succeeded = true
            } catch {
                message = Self.failureMessage(error)
            }
            guard let self else { return }
            self.status = message
            self.isRunning = false
            if succeeded { self.completedRuns += 1 }
            self.handle(self.scheduler.finish())
            self.releaseHoldIfIdle()
        }
    }

    // MARK: - La passe

    /// Écriture hors de l'app (extension AutoFill) : une passe tout de suite,
    /// au mieux. Sans elle l'entrée attendrait le prochain passage de l'app au
    /// premier plan. Un échec ne dit rien : l'app synchronisera à son tour.
    ///
    /// - Parameter timeout: au-delà, la passe est annulée et on rend la main :
    ///   le système n'attend pas une extension indéfiniment.
    nonisolated static func syncAfterExtensionWrite(timeout: TimeInterval = 4) async {
        let key = SecureKeyStore.read()
        guard !key.isEmpty, let credentials = SyncCredentialsStore.load() else { return }
        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                _ = try? await syncEverything(masterKey: key, credentials: credentials)
            }
            group.addTask {
                try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
            }
            await group.next()
            group.cancelAll()
        }
    }

    /// Carnet, offre du compte, réglages : ce que faisait le bouton du carnet.
    nonisolated static func syncEverything(
        masterKey: String, credentials: SyncCredentials
    ) async throws -> Sync.Result {
        // L'app et l'extension AutoFill ne passent jamais en même temps. Les
        // jetons sont relus une fois le bail pris : l'autre a pu les
        // renouveler pendant l'attente, et les anciens ne valent plus rien.
        let lease = await SyncLease.acquire()
        defer { lease?.release() }
        try Task.checkCancellation()
        let credentials = SyncCredentialsStore.load() ?? credentials
        let pending = SyncPending.token()

        let result = try await Sync().syncRenewing(
            VaultStore.load(), masterKey: masterKey, credentials: credentials)

        // Les jetons peuvent avoir été renouvelés pendant l'appel : ne pas les
        // réenregistrer forcerait une reconnexion. L'offre est relue ici, sans
        // quoi l'app resterait sur son ancienne idée jusqu'à la reconnexion.
        var creds =
            (try? await Sync().accountPlan(credentials: result.credentials))
            ?? result.credentials
        SyncCredentialsStore.save(creds)

        // Une écriture a pu arriver pendant l'appel : fusionner avec ce qui est
        // sur le disque plutôt que l'écraser. Elle repartira à la relance.
        let (vault, _) = Vault.merge(result.vault, VaultStore.load())
        try VaultStore.save(vault, to: VaultStore.url())

        // Réglages par défaut, après le carnet. Un échec ici ne remet pas en
        // cause le carnet, déjà synchronisé et enregistré.
        if let renewed = try? await PasswordSettings.syncShared(
            masterKey: masterKey, credentials: creds), renewed != creds
        {
            SyncCredentialsStore.save(renewed)
            creds = renewed
        }

        // Le carnet est parti : plus rien n'est dû, sauf écriture entre-temps.
        SyncPending.clear(ifStill: pending)

        return Sync.Result(
            vault: vault, conflicts: result.conflicts, localOnly: result.localOnly,
            credentials: creds)
    }

    // MARK: - Messages

    nonisolated static func successMessage(_ result: Sync.Result) -> String {
        let kept = result.vault.entries.filter { $0.deleted != true }.count - result.localOnly
        // Au-delà du plafond, le reste ne part pas : le dire, sinon on croit
        // retrouver sur l'autre appareil ce qui n'y est jamais allé.
        let local =
            result.localOnly == 0
            ? ""
            : L10nSync.t(
                ", \(result.localOnly) restées sur cet appareil (plafond de ce compte)",
                ", \(result.localOnly) kept on this device (limit of this account)")
        return result.conflicts.isEmpty
            ? L10nSync.t(
                "Carnet synchronisé : \(kept) entrées\(local).",
                "Vault synced: \(kept) entries\(local).")
            : L10nSync.t(
                "Carnet synchronisé : \(kept) entrées\(local), "
                    + "\(result.conflicts.count) demandent votre attention.",
                "Vault synced: \(kept) entries\(local), \(result.conflicts.count) need "
                    + "your attention.")
    }

    /// 402 : le serveur explique comment lever la limite, ce qu'une app des
    /// magasins n'a pas le droit de relayer. On garde le fait, pas l'invitation.
    nonisolated static func failureMessage(_ error: Error) -> String {
        let syncError = error as? SyncError
        if syncError?.status == 402 {
            return L10nSync.t(
                "Limite de synchronisation atteinte : les entrées en trop restent sur cet "
                    + "appareil.",
                "Sync limit reached: the extra entries stay on this device.")
        }
        let detail = syncError?.message ?? error.localizedDescription
        return L10nSync.t(
            "Échec de la synchronisation : \(detail)", "Sync failed: \(detail)")
    }

    /// Échec de la connexion. Un 402 y est le plafond d'appareils : le message
    /// du service nomme l'offre et renvoie au site, ce qu'une app des magasins
    /// ne relaie pas. On garde le fait, pas l'invitation.
    nonisolated static func signInFailureMessage(_ error: Error) -> String {
        if (error as? SyncError)?.status == 402 {
            return L10nSync.t(
                "Ce compte a atteint son nombre maximal d'appareils connectés. Déconnectez "
                    + "un autre appareil, puis réessayez.",
                "This account has reached its maximum number of connected devices. Sign out "
                    + "of another device, then try again.")
        }
        return failureMessage(error)
    }
}
