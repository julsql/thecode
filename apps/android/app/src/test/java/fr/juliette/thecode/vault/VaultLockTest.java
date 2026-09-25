package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.junit.Test;

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

    private final MemoryStore store = new MemoryStore();
    private final VaultLock lock = new VaultLock(store);

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
    public void aNewInstanceStartsLocked() {
        // Pas de déverrouillage mémorisé : l'état « ouvert » ne vit qu'en mémoire.
        lock.chooseBiometric();
        assertEquals(VaultLock.State.LOCKED, new VaultLock(store).state());
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
    public void leavingOutsideSystemAuthLocksImmediately() {
        lock.chooseBiometric();
        assertTrue(lock.onLeave());
        assertEquals(VaultLock.State.LOCKED, lock.state());
    }

    @Test
    public void deviceCredentialFallbackUnlocksDespiteLeavingDuringThePrompt() {
        lock.chooseBiometric();
        lock.lock();

        lock.beginSystemAuth();
        // L'écran du code de l'appareil fait quitter l'activité.
        assertFalse(lock.onLeave());
        assertFalse(lock.endSystemAuth(true));
        lock.unlock(VaultLock.Method.BIOMETRIC);

        assertEquals(VaultLock.State.UNLOCKED, lock.state());
        assertFalse(lock.isSystemAuthInProgress());
    }

    @Test
    public void switchingMethodSurvivesTheDeviceCredentialScreen() {
        lock.choosePassword(VaultPassword.hash("vault-pass".toCharArray()));

        lock.beginSystemAuth();
        assertFalse(lock.onLeave());
        assertTrue(lock.isUnlocked());
        lock.endSystemAuth(true);
        lock.chooseBiometric();

        assertEquals(VaultLock.Method.BIOMETRIC, lock.method());
        assertTrue(lock.isUnlocked());
    }

    @Test
    public void failedOrCancelledAuthAppliesTheDeferredLock() {
        lock.chooseBiometric();
        lock.beginSystemAuth();
        lock.onLeave();

        assertTrue(lock.endSystemAuth(false));
        assertEquals(VaultLock.State.LOCKED, lock.state());
    }

    @Test
    public void cancelWithoutLeavingKeepsTheCurrentState() {
        lock.chooseBiometric();
        lock.beginSystemAuth();

        assertFalse(lock.endSystemAuth(false));
        assertTrue(lock.isUnlocked());
        // Plus d'auth en cours : la sortie suivante reverrouille.
        assertTrue(lock.onLeave());
    }

    @Test
    public void forgetResetsToSetup() {
        lock.choosePassword(VaultPassword.hash("vault-pass".toCharArray()));
        lock.lock();
        lock.forget();

        assertEquals(VaultLock.State.SETUP, lock.state());
        assertEquals("", store.method);
        assertNull(store.record);
    }
}
