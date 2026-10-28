//
//  AutoSyncTests.swift
//  Synchronisation automatique : quand elle part, et quand elle ne part pas.
//

import Foundation
import Testing

@testable import TheCode

private let t0 = Date(timeIntervalSince1970: 1_000_000)

private let linked = SyncCredentials(
    endpoint: "https://sync.example.test", accessToken: "access-token-fixture",
    refreshToken: "refresh-token-fixture", kdfSalt: "AAECAwQFBgcICQoLDA0ODw")

private let sampleKey = "fixture-master-key"

@MainActor
struct AutoSyncSchedulerTests {

    @Test func writeWaitsForTheDebounce() {
        var scheduler = AutoSyncScheduler()
        let action = scheduler.request(.write, now: t0)
        #expect(action == .wait(2, ticket: 1))
        #expect(!scheduler.isRunning)
    }

    @Test func closeTriggersCollapseIntoTheLastOne() {
        var scheduler = AutoSyncScheduler()
        _ = scheduler.request(.write, now: t0)
        _ = scheduler.request(.settings, now: t0.addingTimeInterval(1))
        let last = scheduler.request(.write, now: t0.addingTimeInterval(1.5))
        #expect(last == .wait(2, ticket: 3))

        // Les attentes remplacées ne lancent rien.
        let stale = [scheduler.fire(ticket: 1), scheduler.fire(ticket: 2)]
        let current = scheduler.fire(ticket: 3)
        #expect(stale == [false, false])
        #expect(current)
        #expect(scheduler.isRunning)
    }

    @Test func aRunIsNeverDoubled() {
        var scheduler = AutoSyncScheduler()
        _ = scheduler.request(.write, now: t0)
        let started = scheduler.fire(ticket: 1)
        let write = scheduler.request(.write, now: t0)
        let manual = scheduler.request(.manual, now: t0)

        #expect(started)
        #expect(write == .none)
        #expect(manual == .none)
        #expect(scheduler.rerunQueued)
    }

    @Test func requestsDuringARunQueueASingleRerun() {
        var scheduler = AutoSyncScheduler()
        _ = scheduler.request(.write, now: t0)
        _ = scheduler.fire(ticket: 1)
        for _ in 0..<5 { _ = scheduler.request(.write, now: t0) }

        guard case .wait(2, let ticket) = scheduler.finish() else {
            Issue.record("une relance était attendue")
            return
        }
        let rerun = scheduler.fire(ticket: ticket)
        let after = scheduler.finish()
        #expect(rerun)
        #expect(after == .none)
    }

    @Test func finishWithoutRequestsStops() {
        var scheduler = AutoSyncScheduler()
        _ = scheduler.request(.manual, now: t0)
        let after = scheduler.finish()
        #expect(after == .none)
        #expect(!scheduler.isRunning)
    }

    @Test func manualRunsAtOnceAndDropsThePendingWait() {
        var scheduler = AutoSyncScheduler()
        _ = scheduler.request(.write, now: t0)
        let manual = scheduler.request(.manual, now: t0)
        #expect(manual == .runNow)
        #expect(scheduler.isRunning)

        _ = scheduler.finish()
        let stale = scheduler.fire(ticket: 1)
        #expect(!stale)
    }

    @Test func openIsThrottledToOnceEvery30Seconds() {
        var scheduler = AutoSyncScheduler()
        let actions = [0, 10, 29.9, 30].map {
            scheduler.request(.open, now: t0.addingTimeInterval($0))
        }
        #expect(actions.map { $0 != .none } == [true, false, false, true])
    }

    @Test func throttledOpenDoesNotQueueDuringARun() {
        var scheduler = AutoSyncScheduler()
        _ = scheduler.request(.open, now: t0)
        _ = scheduler.fire(ticket: 1)
        _ = scheduler.request(.open, now: t0.addingTimeInterval(5))
        #expect(scheduler.isRunning)
        #expect(!scheduler.rerunQueued)
    }

    @Test func writesAreNotThrottled() {
        var scheduler = AutoSyncScheduler()
        _ = scheduler.request(.open, now: t0)
        let write = scheduler.request(.write, now: t0.addingTimeInterval(1))
        let settings = scheduler.request(.settings, now: t0.addingTimeInterval(2))
        #expect(write != .none)
        #expect(settings != .none)
    }
}

@MainActor
struct AutoSyncTriggerTests {

    @Test func needsBothAnAccountAndAMasterKey() {
        #expect(AutoSync.isEligible(credentials: linked, masterKey: sampleKey))
        #expect(!AutoSync.isEligible(credentials: nil, masterKey: sampleKey))
        #expect(!AutoSync.isEligible(credentials: linked, masterKey: ""))
    }

    /// Compte les passes ; l'attente est instantanée.
    private final class Recorder {
        var runs = 0
    }

    private func makeSync(
        _ recorder: Recorder, credentials: SyncCredentials? = linked, key: String = sampleKey,
        fails: Bool = false
    ) -> AutoSync {
        AutoSync(
            clock: { t0 }, sleep: { _ in },
            credentials: { credentials }, masterKey: { key },
            perform: { _, creds in
                recorder.runs += 1
                if fails { throw SyncError(status: 500, message: "boom") }
                return Sync.Result(
                    vault: Vault(), conflicts: [], localOnly: 0, credentials: creds)
            })
    }

    private func settle(_ sync: AutoSync) async {
        for _ in 0..<200 { await Task.yield() }
    }

    @Test func burstOfWritesRunsOnce() async {
        let recorder = Recorder()
        let sync = makeSync(recorder)
        sync.request(.write)
        sync.request(.write)
        sync.request(.settings)
        await settle(sync)
        #expect(recorder.runs == 1)
        #expect(sync.completedRuns == 1)
        #expect(!sync.isRunning)
        #expect(sync.status != nil)
    }

    @Test func aPendingWriteSkipsTheOpenSpacingOnce() async {
        let recorder = Recorder()
        var pending = true
        let sync = AutoSync(
            clock: { t0 }, sleep: { _ in },
            credentials: { linked }, masterKey: { sampleKey },
            perform: { _, creds in
                recorder.runs += 1
                throw SyncError(status: 0, message: "offline")
            },
            isPending: { pending }, markPending: { pending = true })

        sync.request(.open)
        await settle(sync)
        #expect(recorder.runs == 1)

        // Dans les 30 s, l'ouverture suivante serait ignorée : l'écriture due
        // la fait partir quand même, une fois.
        sync.request(.open)
        await settle(sync)
        #expect(recorder.runs == 2)

        // L'échec dure : les ouvertures suivantes retrouvent l'espacement.
        sync.request(.open)
        await settle(sync)
        #expect(recorder.runs == 2)

        // Une nouvelle écriture rouvre ce droit.
        sync.request(.write)
        await settle(sync)
        sync.request(.open)
        await settle(sync)
        #expect(recorder.runs == 4)
    }

    @Test func aWriteIsRememberedEvenWhenNothingCanLeave() async {
        let recorder = Recorder()
        var marks = 0
        let sync = AutoSync(
            clock: { t0 }, sleep: { _ in },
            credentials: { linked }, masterKey: { "" },
            perform: { _, creds in
                recorder.runs += 1
                return Sync.Result(vault: Vault(), conflicts: [], localOnly: 0, credentials: creds)
            },
            isPending: { marks > 0 }, markPending: { marks += 1 })

        sync.request(.write)
        sync.request(.open)
        await settle(sync)

        #expect(marks == 1)
        #expect(recorder.runs == 0)
    }

    @Test func pendingTokenIsOnlyClearedByTheRunThatSawIt() {
        let suite = "sync-pending-tests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }

        #expect(SyncPending.token(in: defaults) == nil)
        SyncPending.mark(in: defaults)
        let seen = SyncPending.token(in: defaults)
        #expect(seen != nil)

        // Une écriture pendant la passe : elle reste due.
        SyncPending.mark(in: defaults)
        SyncPending.clear(ifStill: seen, in: defaults)
        #expect(SyncPending.token(in: defaults) != nil)

        SyncPending.clear(ifStill: SyncPending.token(in: defaults), in: defaults)
        #expect(SyncPending.token(in: defaults) == nil)
        SyncPending.clear(ifStill: nil, in: defaults)
    }

    @Test func leaseIsExclusiveAndAStaleOneIsTaken() async throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("lease-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }

        let first = try #require(await SyncLease.acquire(in: dir))

        // Tenu : un second demandeur attend, et l'obtient à la libération.
        let waiter = Task { await SyncLease.acquire(in: dir, poll: 0.01) }
        try await Task.sleep(nanoseconds: 50_000_000)
        #expect(FileManager.default.fileExists(atPath: first.url.path))
        first.release()
        let second = try #require(await waiter.value)

        // Abandonné par un processus arrêté : repris une fois périmé.
        let third = await SyncLease.acquire(in: dir, staleAfter: 0, poll: 0.01)
        #expect(third != nil)
        third?.release()
        #expect(!FileManager.default.fileExists(atPath: second.url.path))

        #expect(await SyncLease.acquire(in: nil) == nil)
    }

    @Test func nothingLeavesWithoutAccount() async {
        let recorder = Recorder()
        let sync = makeSync(recorder, credentials: nil)
        sync.request(.open)
        sync.syncNow()
        await settle(sync)
        #expect(recorder.runs == 0)
        #expect(sync.status == nil)
    }

    @Test func nothingLeavesWithoutMasterKey() async {
        let recorder = Recorder()
        let sync = makeSync(recorder, key: "")
        sync.request(.write)
        sync.syncNow()
        await settle(sync)
        #expect(recorder.runs == 0)
    }

    @Test func failureOnlyLeavesAStatusLine() async {
        let recorder = Recorder()
        let sync = makeSync(recorder, fails: true)
        sync.syncNow()
        await settle(sync)
        #expect(recorder.runs == 1)
        #expect(sync.completedRuns == 0)
        #expect(sync.status?.contains("boom") == true)
        #expect(!sync.isRunning)
    }

    @Test func settingsTouchReportsOnlyRealChanges() {
        let suite = "autosync-tests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }

        defaults.set(20, forKey: PasswordSettings.Key.lengthNumber)
        #expect(PasswordSettings.touch(defaults))
        // L'écho d'une écriture qui ne change rien ne relance pas.
        #expect(!PasswordSettings.touch(defaults))
        defaults.set(24, forKey: PasswordSettings.Key.lengthNumber)
        #expect(PasswordSettings.touch(defaults))

        // Des réglages distants appliqués ne comptent pas comme un changement.
        PasswordSettings.apply(
            SharedSettings(
                length: 30,
                charset: Charset(lower: true, upper: true, symbols: false, numbers: true),
                updatedAt: "2026-01-01T00:00:00.000Z"),
            to: defaults)
        #expect(!PasswordSettings.touch(defaults))
    }
}
