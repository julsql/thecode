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

    /** Horodatage de la session commune à la clef et au carnet. */
    static final class MemorySession implements SessionLock.Store {
        long at = 0L;

        @Override public long stampedAt() { return at; }
        @Override public void setStampedAt(long stamped) { at = stamped; }
        @Override public void clear() { at = 0L; }
    }

    private static final long GRACE = SessionLock.GRACE_MILLIS;

    private final MemoryStore store = new MemoryStore();
    private final MemorySession session = new MemorySession();
    private long now = 1_000_000L;
    /** La session telle que l'écran principal la voit, pour la clef. */
    private final SessionLock keySession = new SessionLock(session, () -> now);
    /** Écran dont la mise en place a passé l'auth de l'appareil. */
    private final VaultLock lock = authorized(newLock());

    private VaultLock newLock() {
        return new VaultLock(store, new SessionLock(session, () -> now));
    }

    private static VaultLock authorized(VaultLock lock) {
        lock.authorizeSetup();
        return lock;
    }

    // ------------------------------------------- mise en place sans session

    @Test
    public void setupWithoutASessionNeedsDeviceAuth() {
        assertTrue(newLock().setupNeedsDeviceAuth());
    }

    @Test(expected = IllegalStateException.class)
    public void cannotCreateAVaultPasswordWithoutDeviceAuth() {
        newLock().choosePassword(VaultPassword.hash("vault-pass".toCharArray()));
    }

    @Test(expected = IllegalStateException.class)
    public void cannotChooseBiometricsWithoutDeviceAuth() {
        newLock().chooseBiometric();
    }

    @Test
    public void aValidKeySessionDispensesWithDeviceAuth() {
        keySession.stamp();
        VaultLock fresh = newLock();

        assertFalse(fresh.setupNeedsDeviceAuth());
        fresh.choosePassword(VaultPassword.hash("vault-pass".toCharArray()));
        assertTrue(fresh.isUnlocked());
    }

    @Test
    public void deviceAuthAllowsCreatingAPassword() {
        VaultLock fresh = newLock();
        fresh.authorizeSetup();

        assertFalse(fresh.setupNeedsDeviceAuth());
        fresh.choosePassword(VaultPassword.hash("vault-pass".toCharArray()));
        assertTrue(keySession.isValid());
    }

    @Test
    public void forgettingThenCreatingAPasswordCannotUnlockTheKey() {
        lock.chooseBiometric();
        lock.lock();
        lock.forget();

        assertTrue(lock.setupNeedsDeviceAuth());
        try {
            lock.choosePassword(VaultPassword.hash("thief-pass".toCharArray()));
        } catch (IllegalStateException expected) {
            // La garde a tenu.
        }
        assertFalse(keySession.isValid());
        assertEquals(VaultLock.State.SETUP, lock.state());
    }

    @Test
    public void forgetWithAValidSessionStillNeedsDeviceAuth() {
        lock.chooseBiometric();
        assertTrue(keySession.isValid());
        lock.forget();

        assertTrue(lock.setupNeedsDeviceAuth());
    }

    @Test
    public void switchingMethodOnceUnlockedNeedsNoDeviceAuth() {
        lock.choosePassword(VaultPassword.hash("vault-pass".toCharArray()));
        keySession.invalidate();

        assertFalse(lock.setupNeedsDeviceAuth());
        lock.chooseBiometric();
        assertEquals(VaultLock.Method.BIOMETRIC, lock.method());
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
    public void aNewInstanceStartsLockedWithoutASession() {
        lock.chooseBiometric();
        keySession.invalidate();
        assertEquals(VaultLock.State.LOCKED, newLock().state());
    }

    @Test
    public void anUnlockedKeyOpensTheVaultWithoutAsking() {
        lock.chooseBiometric();
        lock.lock();
        now += GRACE;
        keySession.stamp();

        assertEquals(VaultLock.State.UNLOCKED, newLock().state());
    }

    @Test
    public void anExpiredKeySessionDoesNotOpenTheVault() {
        lock.chooseBiometric();
        lock.lock();
        keySession.stamp();
        now += GRACE + 1L;

        assertEquals(VaultLock.State.LOCKED, newLock().state());
    }

    @Test
    public void unlockingTheVaultUnlocksTheKey() {
        lock.choosePassword(VaultPassword.hash("vault-pass".toCharArray()));
        lock.lock();
        assertFalse(keySession.isValid());

        now += 10_000L;
        lock.unlock(VaultLock.Method.PASSWORD);

        assertTrue(keySession.isValid());
        assertEquals(now, session.at);
    }

    @Test
    public void settingUpTheVaultUnlocksTheKey() {
        lock.chooseBiometric();
        assertTrue(keySession.isValid());
    }

    @Test
    public void aKeyUnlockedWhileAwayOpensTheScreenOnReturn() {
        lock.chooseBiometric();
        lock.lock();
        lock.onLeave();
        keySession.stamp();

        assertFalse(lock.onReturn());
        assertTrue(lock.isUnlocked());
    }

    @Test
    public void explicitLockAlsoLocksTheKey() {
        lock.chooseBiometric();
        lock.lock();
        assertFalse(keySession.isValid());
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
        assertEquals(now, session.at);
        assertTrue(keySession.isValid());
    }

    @Test
    public void comingBackWithinTheGraceKeepsTheVaultOpen() {
        lock.chooseBiometric();
        lock.onLeave();
        now += GRACE;

        assertFalse(lock.onReturn());
        assertTrue(lock.isUnlocked());
        // Le retour relance la fenêtre commune.
        assertEquals(now, session.at);
    }

    @Test
    public void comingBackAfterTheGraceLocks() {
        lock.chooseBiometric();
        lock.onLeave();
        now += GRACE + 1L;

        assertTrue(lock.onReturn());
        assertEquals(VaultLock.State.LOCKED, lock.state());
        assertFalse(keySession.isValid());
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

        assertEquals(0L, session.at);
        assertEquals(VaultLock.State.LOCKED, newLock().state());
    }

    @Test
    public void aStaleStampDoesNotOpenAnUnconfiguredVault() {
        session.at = now;
        assertEquals(VaultLock.State.SETUP, newLock().state());
    }

    @Test
    public void explicitLockClearsTheGrace() {
        lock.chooseBiometric();
        lock.onLeave();
        lock.lock();

        assertEquals(0L, session.at);
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
        assertEquals(0L, session.at);
        assertEquals("", store.method);
        assertNull(store.record);
    }
}
