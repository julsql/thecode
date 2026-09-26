package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import fr.juliette.thecode.SessionLock;

/**
 * Machine d'états du verrou de l'écran carnet : biométrie, sinon ressaisie de
 * la clef maîtresse, avec une session commune à la clef.
 */
public class VaultLockTest {

    /** Horodatage de la session commune à la clef et au carnet. */
    static final class MemorySession implements SessionLock.Store {
        long at = 0L;

        @Override public long stampedAt() { return at; }
        @Override public void setStampedAt(long stamped) { at = stamped; }
        @Override public void clear() { at = 0L; }
    }

    private static final long GRACE = SessionLock.GRACE_MILLIS;
    /** Valeur de test, non ASCII pour vérifier la comparaison en UTF-8. */
    private static final String KEY = "sample-" + "été";

    private final MemorySession session = new MemorySession();
    private long now = 1_000_000L;
    /** La clef enregistrée sur l'appareil, vide si aucune. */
    private String storedKey = KEY;
    /** La session telle que l'écran principal la voit, pour la clef. */
    private final SessionLock keySession = new SessionLock(session, () -> now);
    private final VaultLock lock = newLock();

    private VaultLock newLock() {
        return new VaultLock(() -> storedKey, new SessionLock(session, () -> now));
    }

    // --------------------------------------------------------- ouverture

    @Test
    public void startsLockedWithoutASession() {
        assertEquals(VaultLock.State.LOCKED, lock.state());
        assertFalse(lock.isUnlocked());
    }

    @Test
    public void biometricsUnlockWithoutAnySetup() {
        lock.unlockWithBiometrics();

        assertEquals(VaultLock.State.UNLOCKED, lock.state());
        assertTrue(keySession.isValid());
    }

    @Test
    public void biometricsDoNotNeedAMasterKey() {
        storedKey = "";
        lock.unlockWithBiometrics();

        assertTrue(lock.isUnlocked());
    }

    // ------------------------------------------------- clef maîtresse

    @Test
    public void theStoredKeyUnlocks() {
        assertEquals(VaultLock.KeyCheck.OK, lock.unlockWithKey(KEY));

        assertTrue(lock.isUnlocked());
        assertEquals(now, session.at);
    }

    @Test
    public void anotherKeyDoesNotUnlock() {
        assertEquals(VaultLock.KeyCheck.MISMATCH, lock.unlockWithKey(KEY + "x"));
        assertEquals(VaultLock.KeyCheck.MISMATCH, lock.unlockWithKey("sample-ete"));
        assertEquals(VaultLock.KeyCheck.MISMATCH, lock.unlockWithKey(""));

        assertFalse(lock.isUnlocked());
        assertEquals(0L, session.at);
    }

    @Test
    public void withoutAStoredKeyTheUserIsSentToTheMainScreen() {
        storedKey = "";
        assertFalse(lock.hasMasterKey());
        assertEquals(VaultLock.KeyCheck.NO_KEY, lock.unlockWithKey(""));

        storedKey = null;
        assertFalse(lock.hasMasterKey());
        assertEquals(VaultLock.KeyCheck.NO_KEY, lock.unlockWithKey(KEY));

        assertFalse(lock.isUnlocked());
    }

    @Test
    public void theKeyIsReadWhenTyped() {
        // La clef peut changer sur l'écran principal pendant que le carnet est ouvert.
        storedKey = "sample-other";
        assertEquals(VaultLock.KeyCheck.MISMATCH, lock.unlockWithKey(KEY));
        assertEquals(VaultLock.KeyCheck.OK, lock.unlockWithKey("sample-other"));
    }

    @Test
    public void comparisonIsExactOnUtf8Bytes() {
        assertTrue(VaultLock.matches(KEY, KEY));
        assertFalse(VaultLock.matches(KEY, KEY.toUpperCase(java.util.Locale.ROOT)));
        assertFalse(VaultLock.matches(KEY, KEY + " "));
    }

    // ---------------------------------------------------- session commune

    @Test
    public void anUnlockedKeyOpensTheVaultWithoutAsking() {
        keySession.stamp();
        assertEquals(VaultLock.State.UNLOCKED, newLock().state());
    }

    @Test
    public void anExpiredKeySessionDoesNotOpenTheVault() {
        keySession.stamp();
        now += GRACE + 1L;
        assertEquals(VaultLock.State.LOCKED, newLock().state());
    }

    @Test
    public void unlockingTheVaultUnlocksTheKey() {
        lock.unlockWithKey(KEY);
        now += GRACE - 1L;
        assertTrue(keySession.isValid());
    }

    @Test
    public void lockingTheVaultLocksTheKey() {
        lock.unlockWithBiometrics();
        lock.lock();

        assertEquals(VaultLock.State.LOCKED, lock.state());
        assertFalse(keySession.isValid());
        assertEquals(0L, session.at);
    }

    @Test
    public void aKeyUnlockedWhileAwayOpensTheVaultOnReturn() {
        keySession.stamp();
        assertFalse(lock.onReturn());
        assertTrue(lock.isUnlocked());
    }

    // ------------------------------------------------ sortie et retour

    @Test
    public void comingBackWithinTheGraceKeepsTheVaultOpen() {
        lock.unlockWithBiometrics();
        lock.onLeave();
        now += GRACE;

        assertFalse(lock.onReturn());
        assertTrue(lock.isUnlocked());
        // Le retour relance la fenêtre commune.
        assertEquals(now, session.at);
    }

    @Test
    public void comingBackAfterTheGraceLocks() {
        lock.unlockWithKey(KEY);
        lock.onLeave();
        now += GRACE + 1L;

        assertTrue(lock.onReturn());
        assertEquals(VaultLock.State.LOCKED, lock.state());
        assertFalse(keySession.isValid());
    }

    @Test
    public void aRecreatedScreenWithinTheGraceStartsUnlocked() {
        lock.unlockWithKey(KEY);
        lock.onLeave();
        now += GRACE - 1L;

        VaultLock recreated = newLock();
        assertEquals(VaultLock.State.UNLOCKED, recreated.state());
        assertFalse(recreated.onReturn());
        assertTrue(recreated.isUnlocked());
    }

    @Test
    public void clockGoingBackwardsLocks() {
        lock.unlockWithBiometrics();
        lock.onLeave();
        now -= 1L;

        assertEquals(VaultLock.State.LOCKED, newLock().state());
        assertTrue(lock.onReturn());
        assertFalse(lock.isUnlocked());
    }

    @Test
    public void leavingWhileLockedStoresNothing() {
        lock.unlockWithBiometrics();
        lock.lock();
        lock.onLeave();

        assertEquals(0L, session.at);
        assertEquals(VaultLock.State.LOCKED, newLock().state());
    }

    // ------------------------------------------- invite système en cours

    @Test
    public void deviceCredentialFallbackUnlocksDespiteLeavingDuringThePrompt() {
        lock.beginSystemAuth();
        // L'écran du code de l'appareil fait quitter l'activité.
        lock.onLeave();
        assertFalse(lock.onReturn());
        assertFalse(lock.endSystemAuth(true));
        lock.unlockWithBiometrics();

        assertEquals(VaultLock.State.UNLOCKED, lock.state());
        assertFalse(lock.isSystemAuthInProgress());
    }

    @Test
    public void returnDuringSystemAuthIsDecidedByItsOutcome() {
        lock.unlockWithBiometrics();
        lock.beginSystemAuth();
        lock.onLeave();
        now += GRACE + 1L;

        // onStart peut précéder le rappel de l'invite : il ne tranche pas.
        assertFalse(lock.onReturn());
        assertTrue(lock.isUnlocked());
        assertTrue(lock.endSystemAuth(false));
        assertEquals(VaultLock.State.LOCKED, lock.state());
    }

    @Test
    public void failedAuthAfterLeavingWithinTheGraceKeepsTheVaultOpen() {
        lock.unlockWithKey(KEY);
        lock.beginSystemAuth();
        lock.onLeave();

        assertFalse(lock.endSystemAuth(false));
        assertTrue(lock.isUnlocked());
    }

    @Test
    public void failedAuthFromALockedScreenDoesNotReportARelock() {
        lock.beginSystemAuth();
        lock.onLeave();

        assertFalse(lock.endSystemAuth(false));
        assertEquals(VaultLock.State.LOCKED, lock.state());
    }

    @Test
    public void cancelWithoutLeavingKeepsTheCurrentState() {
        lock.unlockWithBiometrics();
        lock.beginSystemAuth();

        assertFalse(lock.endSystemAuth(false));
        assertTrue(lock.isUnlocked());
        assertFalse(lock.isSystemAuthInProgress());
    }
}
