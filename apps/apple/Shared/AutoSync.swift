//
//  AutoSync.swift
//  Synchronisation automatique du carnet puis des réglages par défaut.
//
//  Voir shared/spec/vault-sync.md, « Synchronisation automatique ». Les
//  déclencheurs (ouverture, écriture, réglage) viennent des écrans ; ici on
//  décide quand lancer, et on lance sans jamais bloquer l'écran : le résultat
//  n'est qu'une ligne d'état dans la zone de synchronisation du carnet.
//
//  Dans Shared pour servir aux deux apps. L'extension AutoFill le compile
//  aussi sans s'en servir : ses enregistrements partent à la prochaine
//  ouverture de l'app.
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

    init(
        clock: @escaping () -> Date = Date.init,
        sleep: @escaping (TimeInterval) async -> Void = { delay in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
        },
        credentials: @escaping () -> SyncCredentials? = { SyncCredentialsStore.load() },
        masterKey: @escaping () -> String = { SecureKeyStore.read() },
        perform: @escaping Perform = { key, creds in
            try await AutoSync.syncEverything(masterKey: key, credentials: creds)
        }
    ) {
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
        guard Self.isEligible(credentials: credentials(), masterKey: masterKey()) else { return }
        handle(scheduler.request(trigger, now: clock()))
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
        }
    }

    // MARK: - La passe

    /// Carnet, offre du compte, réglages : ce que faisait le bouton du carnet.
    nonisolated static func syncEverything(
        masterKey: String, credentials: SyncCredentials
    ) async throws -> Sync.Result {
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
                ", \(result.localOnly) restées sur cet appareil (plafond de l'offre gratuite)",
                ", \(result.localOnly) kept on this device (free plan limit)")
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
}
