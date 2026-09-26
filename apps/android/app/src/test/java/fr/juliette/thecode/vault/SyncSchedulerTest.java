package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.After;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.Executor;

/** Synchronisation automatique : shared/spec/vault-sync.md, « Synchronisation automatique ». */
public class SyncSchedulerTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    /** Horloge et minuterie à la main : le temps n'avance que quand le test le dit. */
    private static final class FakeTime implements SyncScheduler.Clock, SyncScheduler.Timer {
        long now = 1_000_000;
        private final List<long[]> dueAt = new ArrayList<>();
        private final List<Runnable> tasks = new ArrayList<>();

        @Override
        public long now() {
            return now;
        }

        @Override
        public SyncScheduler.Cancellable schedule(Runnable task, long delayMs) {
            long[] due = {now + delayMs};
            dueAt.add(due);
            tasks.add(task);
            return () -> {
                int i = dueAt.indexOf(due);
                if (i >= 0) {
                    dueAt.remove(i);
                    tasks.remove(i);
                }
            };
        }

        void advance(long ms) {
            now += ms;
            boolean ran = true;
            while (ran) {
                ran = false;
                Iterator<long[]> it = dueAt.iterator();
                for (int i = 0; it.hasNext(); i++) {
                    if (it.next()[0] <= now) {
                        Runnable task = tasks.remove(i);
                        it.remove();
                        task.run();
                        ran = true;
                        break;
                    }
                }
            }
        }

        int pending() {
            return dueAt.size();
        }
    }

    /** Fil de travail retenu : chaque synchronisation se termine quand le test le décide. */
    private static final class HeldExecutor implements Executor {
        final List<Runnable> queue = new ArrayList<>();

        @Override
        public void execute(Runnable command) {
            queue.add(command);
        }

        void finishOne() {
            queue.remove(0).run();
        }
    }

    private final FakeTime time = new FakeTime();
    private final HeldExecutor worker = new HeldExecutor();
    private boolean ready = true;
    private int runs = 0;

    private SyncScheduler scheduler() {
        return new SyncScheduler(time, time, worker, () -> ready, () -> runs++);
    }

    private SyncScheduler inlineScheduler() {
        return new SyncScheduler(time, time, Runnable::run, () -> ready, () -> runs++);
    }

    @After
    public void unhook() {
        Vault.setWriteListener(null);
    }

    @Test
    public void waitsTwoSecondsAfterTheLastChange() {
        SyncScheduler s = inlineScheduler();
        s.onChange();
        time.advance(1_500);
        s.onChange();
        time.advance(1_999);
        assertEquals(0, runs);

        time.advance(1);
        assertEquals(1, runs);
    }

    @Test
    public void mergesABurstOfChangesIntoOneRun() {
        SyncScheduler s = inlineScheduler();
        for (int i = 0; i < 10; i++) {
            s.onChange();
            time.advance(100);
        }
        time.advance(SyncScheduler.DEBOUNCE_MS);
        assertEquals(1, runs);
        assertEquals(0, time.pending());
    }

    @Test
    public void neverOverlapsAndQueuesASingleRerun() {
        SyncScheduler s = scheduler();
        s.runNow();
        assertTrue(s.isRunning());
        assertEquals(1, worker.queue.size());

        // Trois demandes pendant qu'elle tourne : une seule relance après.
        s.runNow();
        s.onChange();
        time.advance(SyncScheduler.DEBOUNCE_MS);
        s.runNow();
        assertEquals(1, worker.queue.size());

        worker.finishOne();
        assertEquals(1, runs);
        assertTrue(s.isRunning());
        assertEquals(1, worker.queue.size());

        worker.finishOne();
        assertEquals(2, runs);
        assertFalse(s.isRunning());
        assertTrue(worker.queue.isEmpty());
    }

    @Test
    public void manualRunDoesNotWaitAndCancelsThePendingOne() {
        SyncScheduler s = inlineScheduler();
        s.onChange();
        s.runNow();
        assertEquals(1, runs);

        time.advance(SyncScheduler.DEBOUNCE_MS);
        assertEquals(1, runs);
    }

    @Test
    public void openIsThrottledToOnceEveryThirtySeconds() {
        SyncScheduler s = inlineScheduler();
        s.onOpen();
        time.advance(SyncScheduler.DEBOUNCE_MS);
        assertEquals(1, runs);

        s.onOpen();
        time.advance(SyncScheduler.DEBOUNCE_MS);
        assertEquals(1, runs);

        time.advance(SyncScheduler.OPEN_THROTTLE_MS);
        s.onOpen();
        time.advance(SyncScheduler.DEBOUNCE_MS);
        assertEquals(2, runs);
    }

    @Test
    public void throttleDoesNotApplyToChanges() {
        SyncScheduler s = inlineScheduler();
        s.onOpen();
        time.advance(SyncScheduler.DEBOUNCE_MS);
        s.onChange();
        time.advance(SyncScheduler.DEBOUNCE_MS);
        assertEquals(2, runs);
    }

    @Test
    public void nothingLeavesWithoutAccountOrMasterKey() {
        ready = false;
        SyncScheduler s = inlineScheduler();
        s.onOpen();
        s.onChange();
        s.runNow();
        time.advance(SyncScheduler.OPEN_THROTTLE_MS);
        assertEquals(0, runs);
        assertEquals(0, time.pending());

        // Une ouverture refusée ne consomme pas l'espacement.
        ready = true;
        s.onOpen();
        time.advance(SyncScheduler.DEBOUNCE_MS);
        assertEquals(1, runs);
    }

    @Test
    public void accountUnlinkedWhileWaitingSkipsTheRun() {
        SyncScheduler s = inlineScheduler();
        s.onChange();
        ready = false;
        time.advance(SyncScheduler.DEBOUNCE_MS);
        assertEquals(0, runs);
        assertFalse(s.isRunning());
    }

    @Test
    public void aFailingRunDoesNotJamTheScheduler() {
        SyncScheduler s = new SyncScheduler(time, time, Runnable::run, () -> true, () -> {
            runs++;
            throw new IllegalStateException("réseau");
        });
        try {
            s.runNow();
        } catch (IllegalStateException expected) {
            // L'exécuteur en ligne la propage ; un vrai fil l'aurait avalée.
        }
        assertFalse(s.isRunning());
        s.onChange();
        try {
            time.advance(SyncScheduler.DEBOUNCE_MS);
        } catch (IllegalStateException expected) {
            // idem
        }
        assertEquals(2, runs);
    }

    // ------------------------------------------------- écriture du carnet

    @Test
    public void savingTheVaultTriggersASync() throws Exception {
        SyncScheduler s = inlineScheduler();
        s.watchVaultWrites();
        File dir = tmp.newFolder();

        Vault vault = new Vault();
        vault.upsertAccount("example.com", "alice", 20, true, true, true, true);
        vault.save(dir);
        assertEquals(0, runs);

        time.advance(SyncScheduler.DEBOUNCE_MS);
        assertEquals(1, runs);
        assertEquals(1, Vault.load(dir).entries.size());
    }

    @Test
    public void writingTheSyncResultDoesNotLoop() throws Exception {
        SyncScheduler s = inlineScheduler();
        s.watchVaultWrites();
        File dir = tmp.newFolder();

        new Vault().saveSynced(dir);
        time.advance(SyncScheduler.DEBOUNCE_MS);
        assertEquals(0, runs);
    }

    @Test
    public void everyKindOfWriteTriggersASync() throws Exception {
        SyncScheduler s = inlineScheduler();
        s.watchVaultWrites();
        File dir = tmp.newFolder();

        Vault vault = new Vault();
        VaultEntry entry = vault.upsertAccount("example.com", "", 20, true, true, true, true);
        vault.save(dir);
        time.advance(SyncScheduler.DEBOUNCE_MS);

        // Renouvellement.
        entry.counter += 1;
        entry.updatedAt = Vault.nowIso();
        vault.save(dir);
        time.advance(SyncScheduler.DEBOUNCE_MS);

        // Suppression.
        vault.delete(entry.id);
        vault.save(dir);
        time.advance(SyncScheduler.DEBOUNCE_MS);

        // Import : fusion puis écriture.
        Vault incoming = new Vault();
        incoming.upsertAccount("example.org", "", 16, true, true, false, true);
        Vault.merge(Vault.load(dir), incoming, new ArrayList<>()).save(dir);
        time.advance(SyncScheduler.DEBOUNCE_MS);

        assertEquals(4, runs);
    }
}
