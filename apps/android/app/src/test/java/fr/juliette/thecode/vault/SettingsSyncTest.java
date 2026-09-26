package fr.juliette.thecode.vault;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

/** Réglages par défaut partagés avec le compte : shared/spec/default-settings.md. */
public class SettingsSyncTest {

    private static final Sync.Credentials CREDS =
            new Sync.Credentials("https://example.test/api", "access-1", "refresh-0");

    private static DefaultSettings settings(int length, boolean symbols, String updatedAt) {
        return new DefaultSettings(length, true, true, symbols, true, updatedAt);
    }

    @Test
    public void pushesLocalWhenTheAccountHasNone() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        DefaultSettings local = settings(24, false, "2026-01-15T10:30:00Z");

        DefaultSettings kept = new Sync(server).syncSettings(local, "clef", CREDS);

        assertSame(local, kept);
        assertEquals(1, server.settingsPuts);
        assertTrue(server.settings.has("nonce"));
        assertTrue(server.settings.has("blob"));
    }

    @Test
    public void sendsNothingReadable() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        new Sync(server).syncSettings(settings(37, false, "2026-01-15T10:30:00Z"), "clef", CREDS);

        for (String body : server.sentBodies) {
            assertFalse(body, body.contains("length"));
            assertFalse(body, body.contains("37"));
            assertFalse(body, body.contains("updatedAt"));
        }
    }

    @Test
    public void newerRemoteWinsAndIsNotPushedBack() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        Sync sync = new Sync(server);
        sync.syncSettings(settings(30, false, "2026-02-01T00:00:00Z"), "clef", CREDS);

        DefaultSettings kept =
                sync.syncSettings(settings(12, true, "2026-01-01T00:00:00Z"), "clef", CREDS);

        assertEquals(30, kept.length);
        assertFalse(kept.symbols);
        assertEquals("2026-02-01T00:00:00Z", kept.updatedAt);
        assertEquals(1, server.settingsPuts);
    }

    @Test
    public void newerLocalWinsAndIsPushed() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        Sync sync = new Sync(server);
        sync.syncSettings(settings(30, false, "2026-01-01T00:00:00Z"), "clef", CREDS);

        DefaultSettings local = settings(12, true, "2026-02-01T00:00:00Z");
        assertSame(local, sync.syncSettings(local, "clef", CREDS));
        assertEquals(2, server.settingsPuts);

        // Un autre appareil, jamais modifié, reçoit la dernière valeur.
        DefaultSettings other = sync.syncSettings(
                new DefaultSettings(20, true, true, true, true, DefaultSettings.NEVER),
                "clef", CREDS);
        assertEquals(12, other.length);
    }

    @Test
    public void neverPushesSettingsThatWereNeverChanged() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        Sync sync = new Sync(server);

        sync.syncSettings(new DefaultSettings(20, true, true, true, true, DefaultSettings.NEVER),
                "clef", CREDS);

        assertEquals(0, server.settingsPuts);
    }

    @Test
    public void aTieKeepsTheRemote() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        Sync sync = new Sync(server);
        sync.syncSettings(settings(30, false, "2026-01-01T00:00:00Z"), "clef", CREDS);

        DefaultSettings kept =
                sync.syncSettings(settings(12, true, "2026-01-01T00:00:00Z"), "clef", CREDS);

        assertEquals(30, kept.length);
        assertEquals(1, server.settingsPuts);
    }

    @Test
    public void comparesDatesNotStrings() throws Exception {
        // « .500Z » précède « Z » en ordre de chaînes, mais pas dans le temps.
        DefaultSettings withMillis = settings(10, true, "2026-01-01T00:00:00.500Z");
        DefaultSettings plain = settings(11, true, "2026-01-01T00:00:00Z");
        assertSame(withMillis, DefaultSettings.newest(withMillis, plain));
        assertSame(withMillis, DefaultSettings.newest(plain, withMillis));
    }

    @Test
    public void anUndecryptableBlobIsIgnored() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        Sync sync = new Sync(server);
        sync.syncSettings(settings(30, false, "2026-01-01T00:00:00Z"), "autre-clef", CREDS);
        JSONObject before = new JSONObject(server.settings.toString());

        DefaultSettings local = settings(12, true, "2026-02-01T00:00:00Z");
        assertSame(local, sync.syncSettings(local, "clef", CREDS));

        // Ni écrasé localement, ni écrasé à distance.
        assertEquals(1, server.settingsPuts);
        assertEquals(before.toString(), server.settings.toString());
    }

    @Test
    public void runsAfterAVaultSyncWithTheSameAccount() throws Exception {
        FakeVaultServer server = new FakeVaultServer();
        Sync sync = new Sync(server);
        Sync.Result result = sync.syncRenewing(new Vault(), "clef", CREDS);

        assertNull(server.settings);
        sync.syncSettings(settings(16, true, "2026-01-01T00:00:00Z"), "clef", result.credentials);
        assertEquals(1, server.settingsPuts);
    }

    @Test
    public void rejectsOutOfBoundsOrEmptyCharsets() {
        assertThrows(Exception.class, () -> DefaultSettings.fromJson(
                settings(3, true, "2026-01-01T00:00:00Z").toJson()));
        assertThrows(Exception.class, () -> DefaultSettings.fromJson(
                new DefaultSettings(20, false, false, false, false, "2026-01-01T00:00:00Z")
                        .toJson()));
        assertThrows(Exception.class, () -> DefaultSettings.fromJson(
                settings(20, true, "hier").toJson()));
    }

    @Test
    public void roundTripsThroughJson() throws Exception {
        DefaultSettings s = settings(40, false, "2026-01-15T10:30:00Z");
        DefaultSettings back = DefaultSettings.fromJson(s.toJson());
        assertTrue(s.sameValues(back));
        assertEquals(s.updatedAt, back.updatedAt);
    }
}
