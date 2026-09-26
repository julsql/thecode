package fr.juliette.thecode;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * Fenêtre de grâce de l'authentification : on teste la logique pure
 * ({@code isWithinGrace}) plutôt que le stockage, pour ne dépendre ni des
 * SharedPreferences ni de l'horloge système.
 */
public class SessionLockTest {

    private static final long GRACE = SessionLock.GRACE_MILLIS;

    @Test
    public void rejectsWhenNeverAuthenticated() {
        assertFalse(SessionLock.isWithinGrace(0L, 1_000L));
    }

    @Test
    public void acceptsImmediatelyAfterAuth() {
        assertTrue(SessionLock.isWithinGrace(1_000L, 1_000L));
    }

    @Test
    public void acceptsInsideGraceWindow() {
        assertTrue(SessionLock.isWithinGrace(1_000L, 1_000L + GRACE - 1L));
    }

    @Test
    public void acceptsExactlyAtGraceBoundary() {
        assertTrue(SessionLock.isWithinGrace(1_000L, 1_000L + GRACE));
    }

    @Test
    public void rejectsPastGraceWindow() {
        assertFalse(SessionLock.isWithinGrace(1_000L, 1_000L + GRACE + 1L));
    }

    /** Horloge reculée : on préfère reverrouiller plutôt que prolonger. */
    @Test
    public void rejectsStampInTheFuture() {
        assertFalse(SessionLock.isWithinGrace(2_000L, 1_000L));
    }

    private long stored = 0L;
    private long now = 1_000_000L;
    private final SessionLock lock = new SessionLock(new SessionLock.Store() {
        @Override public long stampedAt() { return stored; }
        @Override public void setStampedAt(long at) { stored = at; }
        @Override public void clear() { stored = 0L; }
    }, () -> now);

    @Test
    public void stampOpensTheSessionForTheGrace() {
        assertFalse(lock.isValid());
        lock.stamp();
        now += GRACE;
        assertTrue(lock.isValid());
        now += 1L;
        assertFalse(lock.isValid());
    }

    @Test
    public void invalidateEndsTheSession() {
        lock.stamp();
        lock.invalidate();
        assertFalse(lock.isValid());
    }
}
