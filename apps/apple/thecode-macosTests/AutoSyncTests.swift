//
//  AutoSyncTests.swift
//  Synchronisation automatique : quand elle part, et quand elle ne part pas.
//

import Foundation
import Testing

@testable import TheCode_for_Mac

private let t0 = Date(timeIntervalSince1970: 1_000_000)

private let linked = SyncCredentials(
    endpoint: "https://sync.example.test", accessToken: "access-token-fixture",
    refreshToken: "refresh-token-fixture")

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
