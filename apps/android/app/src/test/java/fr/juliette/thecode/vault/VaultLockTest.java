package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.junit.Test;

import fr.juliette.thecode.SessionLock;

/** Machine d'états du verrou de l'écran carnet. */
public class VaultLockTest {

    static final class MemoryStore implements VaultLock.Store {
        String method = "";
        String record = null;

        @NonNull @Override public String method() { return method; }
        @Override public void setMethod(@NonNull String m) { method = m; }
        @Nullable @Override public String passwordRecord() { return record; }
        @Override public void setPasswordRecord(@Nullable String r) { record = r; }
        @Override public void clear() { method = ""; record = null; }
    }

    static final class MemorySession implements VaultLock.Session {
        long leftAt = 0L;

        @Override public long leftAt() { return leftAt; }
        @Override public void setLeftAt(long at) { leftAt = at; }
        @Override public void clear() { leftAt = 0L; }
    }

    private static final long GRACE = SessionLock.GRACE_MILLIS;

    private final MemoryStore store = new MemoryStore();
    private final MemorySession session = new MemorySession();
    private long now = 1_000_000L;
    private final VaultLock.Clock clock = () -> now;
    private final VaultLock lock = newLock();

    private VaultLock newLock() {
        return new VaultLock(store, session, clock);
    }

    @Test
    public void firstOpeningAsksForSetup() {
        assertEquals(VaultLock.State.SETUP, lock.state());
        assertFalse(lock.isUnlocked());
    }

    @Test
    public void choosingPasswordUnlocksAndStoresOnlyTheRecord() {
        String record = VaultPassword.hash("vault-pass".toCharArray());
        lock.choosePassword(record);

        assertEquals(VaultLock.State.UNLOCKED, lock.state());
        assertEquals(VaultLock.Method.PASSWORD, lock.method());
        assertEquals(record, store.record);
        assertFalse(store.record.contains("vault-pass"));
    }

    @Test
    public void lockThenUnlockWithPassword() {
        lock.choosePassword(VaultPassword.hash("vault-pass".toCharArray()));
        lock.lock();
        assertEquals(VaultLock.State.LOCKED, lock.state());

        assertFalse(lock.verifyPassword("wrong-pass".toCharArray()));
        assertTrue(lock.verifyPassword("vault-pass".toCharArray()));
        lock.unlock(VaultLock.Method.PASSWORD);
        assertEquals(VaultLock.State.UNLOCKED, lock.state());
    }

    @Test
    public void aNewInstanceStartsLockedWithoutARecentLeave() {
        lock.chooseBiometric();
        assertEquals(VaultLock.State.LOCKED, newLock().state());
    }

    @Test(expected = IllegalStateException.class)
    public void cannotUnlockWithAnotherMethod() {
        lock.chooseBiometric();
        lock.lock();
        lock.unlock(VaultLock.Method.PASSWORD);
    }

    @Test(expected = IllegalStateException.class)
    public void cannotSwitchMethodWhileLocked() {
        lock.chooseBiometric();
        lock.lock();
        lock.choosePassword(VaultPassword.hash("vault-pass".toCharArray()));
    }

    @Test
    public void biometricMethodCannotBeUnlockedByPassword() {
        lock.chooseBiometric();
        lock.lock();
        assertFalse(lock.verifyPassword("anything".toCharArray()));
    }

    @Test
    public void switchingToBiometricDropsThePasswordRecord() {
        lock.choosePassword(VaultPassword.hash("vault-pass".toCharArray()));
        lock.chooseBiometric();

        assertEquals(VaultLock.Method.BIOMETRIC, lock.method());
        assertNull(store.record);
        assertTrue(lock.isUnlocked());
    }

    @Test
    public void changePasswordReplacesTheRecord() {
        lock.choosePassword(VaultPassword.hash("old-password".toCharArray()));
        lock.changePassword(VaultPassword.hash("new-password".toCharArray()));
        lock.lock();

        assertFalse(lock.verifyPassword("old-password".toCharArray()));
        assertTrue(lock.verifyPassword("new-password".toCharArray()));
    }

    @Test(expected = IllegalStateException.class)
    public void changePasswordNeedsAnUnlockedVault() {
        lock.choosePassword(VaultPassword.hash("old-password".toCharArray()));
        lock.lock();
        lock.changePassword(VaultPassword.hash("new-password".toCharArray()));
    }

    @Test
    public void leavingKeepsTheVaultOpenAndStoresOnlyATimestamp() {
        lock.chooseBiometric();
        lock.onLeave();

        assertTrue(lock.isUnlocked());
        assertEquals(now, session.leftAt);
    }

    @Test
    public void comingBackWithinTheGraceKeepsTheVaultOpen() {
        lock.chooseBiometric();
        lock.onLeave();
        now += GRACE;

        assertFalse(lock.onReturn());
        assertTrue(lock.isUnlocked());
        assertEquals(0L, session.leftAt);
    }

    @Test
    public void comingBackAfterTheGraceLocks() {
        lock.chooseBiometric();
        lock.onLeave();
        now += GRACE + 1L;

        assertTrue(lock.onReturn());
        assertEquals(VaultLock.State.LOCKED, lock.state());
        assertEquals(0L, session.leftAt);
    }

    @Test
    public void aRecreatedScreenWithinTheGraceStartsUnlocked() {
        lock.choosePassword(VaultPassword.hash("vault-pass".toCharArray()));
        lock.onLeave();
        now += GRACE - 1L;

        VaultLock recreated = newLock();
        assertEquals(VaultLock.State.UNLOCKED, recreated.state());
        assertFalse(recreated.onReturn());
        assertTrue(recreated.isUnlocked());
    }

    @Test
    public void aRecreatedScreenAfterTheGraceStartsLocked() {
        lock.chooseBiometric();
        lock.onLeave();
        now += GRACE + 1L;

        assertEquals(VaultLock.State.LOCKED, newLock().state());
    }

    @Test
    public void clockGoingBackwardsLocks() {
        lock.chooseBiometric();
        lock.onLeave();
        now -= 1L;

        assertEquals(VaultLock.State.LOCKED, newLock().state());
        assertTrue(lock.onReturn());
        assertFalse(lock.isUnlocked());
    }

    @Test
    public void leavingWhileLockedStoresNothing() {
        lock.chooseBiometric();
        lock.onLeave();
        lock.lock();
        lock.onLeave();

        assertEquals(0L, session.leftAt);
        assertEquals(VaultLock.State.LOCKED, newLock().state());
    }

    @Test
    public void aStaleStampDoesNotOpenAnUnconfiguredVault() {
        session.leftAt = now;
        assertEquals(VaultLock.State.SETUP, newLock().state());
    }

    @Test
    public void explicitLockClearsTheGrace() {
        lock.chooseBiometric();
        lock.onLeave();
        lock.lock();

        assertEquals(0L, session.leftAt);
        assertEquals(VaultLock.State.LOCKED, newLock().state());
    }

    @Test
    public void deviceCredentialFallbackUnlocksDespiteLeavingDuringThePrompt() {
        lock.chooseBiometric();
        lock.lock();

        lock.beginSystemAuth();
        // L'écran du code de l'appareil fait quitter l'activité.
        lock.onLeave();
        assertFalse(lock.onReturn());
        assertFalse(lock.endSystemAuth(true));
        lock.unlock(VaultLock.Method.BIOMETRIC);

        assertEquals(VaultLock.State.UNLOCKED, lock.state());
        assertFalse(lock.isSystemAuthInProgress());
    }

    @Test
    public void switchingMethodSurvivesTheDeviceCredentialScreen() {
        lock.choosePassword(VaultPassword.hash("vault-pass".toCharArray()));

        lock.beginSystemAuth();
        lock.onLeave();
        assertTrue(lock.isUnlocked());
        assertFalse(lock.endSystemAuth(true));
        assertEquals(0L, session.leftAt);
        lock.chooseBiometric();

        assertEquals(VaultLock.Method.BIOMETRIC, lock.method());
        assertTrue(lock.isUnlocked());
    }

    @Test
    public void returnDuringSystemAuthIsDecidedByItsOutcome() {
        lock.choosePassword(VaultPassword.hash("vault-pass".toCharArray()));
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
        lock.choosePassword(VaultPassword.hash("vault-pass".toCharArray()));
        lock.beginSystemAuth();
        lock.onLeave();

        assertFalse(lock.endSystemAuth(false));
        assertTrue(lock.isUnlocked());
    }

    @Test
    public void failedAuthFromALockedScreenDoesNotReportARelock() {
        lock.chooseBiometric();
        lock.lock();
        lock.beginSystemAuth();
        lock.onLeave();

        assertFalse(lock.endSystemAuth(false));
        assertEquals(VaultLock.State.LOCKED, lock.state());
    }

    @Test
    public void cancelWithoutLeavingKeepsTheCurrentState() {
        lock.chooseBiometric();
        lock.beginSystemAuth();

        assertFalse(lock.endSystemAuth(false));
        assertTrue(lock.isUnlocked());
        assertFalse(lock.isSystemAuthInProgress());
    }

    @Test
    public void forgetResetsToSetupAndClearsTheGrace() {
        lock.choosePassword(VaultPassword.hash("vault-pass".toCharArray()));
        lock.onLeave();
        lock.forget();

        assertEquals(VaultLock.State.SETUP, lock.state());
        assertEquals(0L, session.leftAt);
        assertEquals("", store.method);
        assertNull(store.record);
    }
}
