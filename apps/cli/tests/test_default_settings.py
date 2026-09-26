"""Réglages par défaut : retenus localement, partagés avec le compte.

Voir shared/spec/default-settings.md.
"""

from __future__ import annotations

import json

import pytest

from thecode import settings
from thecode import sync as sync_module
from thecode.cli import main
from thecode.core import generate_password_v2
from thecode.sync import (
    SETTINGS_IGNORED,
    SETTINGS_PULLED,
    SETTINGS_PUSHED,
    SETTINGS_UNCHANGED,
    Credentials,
    SyncError,
    _seal,
    sync_settings,
)
from thecode.transfer import derive_transfer_key
from thecode.vault import load, new_entry, save

from .test_sync import CREDS, FakeServer

SHORT = {
    "length": 12,
    "charset": {"lower": True, "upper": True, "symbols": False, "numbers": True},
    "updatedAt": "2026-02-01T00:00:00Z",
}


@pytest.fixture
def server(monkeypatch):
    fake = FakeServer()
    monkeypatch.setattr(sync_module, "_request", fake)
    return fake


@pytest.fixture
def french(monkeypatch):
    for var in ("LC_ALL", "LC_MESSAGES"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("LANG", "fr_FR.UTF-8")


def sealed(value, master_key="clef"):
    return _seal(value, derive_transfer_key(master_key))


def remote_of(server, master_key="clef"):
    return sync_module._decrypt_entry(server.settings, derive_transfer_key(master_key))


def run(capsys, *argv):
    assert main(list(argv)) == 0
    return capsys.readouterr().out.strip().splitlines()[-1]


class TestLocal:
    def test_factory_values_when_nothing_is_saved(self):
        assert settings.load() == settings.factory()
        assert settings.factory()["length"] == 20
        assert all(settings.factory()["charset"].values())

    def test_corrupt_file_falls_back_to_factory(self):
        settings.settings_path().parent.mkdir(parents=True)
        settings.settings_path().write_text("{pas du json", encoding="utf-8")
        assert settings.load() == settings.factory()

    def test_round_trip(self):
        settings.save(SHORT)
        assert settings.load() == SHORT

    def test_update_keeps_what_is_not_given(self):
        result = settings.updated(SHORT, None, {"symbols": True, "lower": None})
        assert result["length"] == 12
        assert result["charset"]["symbols"] is True
        assert result["updatedAt"] > SHORT["updatedAt"]

    @pytest.mark.parametrize("length", [3, 41])
    def test_length_is_bounded(self, length):
        with pytest.raises(ValueError, match="4 et 40"):
            settings.updated(settings.factory(), length, {})

    def test_one_charset_stays_on(self):
        off = dict.fromkeys(settings.CHARSET_KEYS, False)
        with pytest.raises(ValueError, match="Au moins un"):
            settings.updated(settings.factory(), None, off)

    def test_milliseconds_compare_as_instants(self):
        """« …00.5Z » est postérieur à « …00Z », malgré l'ordre lexical."""
        later = {**SHORT, "updatedAt": "2026-02-01T00:00:00.500Z"}
        assert settings.instant(later) > settings.instant(SHORT)


class TestSharedWithTheAccount:
    def test_pushes_local_when_the_account_has_none(self, server):
        kept, outcome, _ = sync_settings(SHORT, "clef", CREDS)

        assert (kept, outcome) == (SHORT, SETTINGS_PUSHED)
        assert remote_of(server) == SHORT
        # Chiffrés comme une entrée : rien de lisible ne part.
        assert "updatedAt" not in server.sent[-1]

    def test_factory_values_are_not_pushed(self, server):
        _, outcome, _ = sync_settings(settings.factory(), "clef", CREDS)

        assert outcome == SETTINGS_UNCHANGED
        assert server.settings_puts == 0

    def test_takes_the_more_recent_remote(self, server):
        server.settings = sealed(SHORT)
        older = {**settings.factory(), "updatedAt": "2026-01-01T00:00:00Z"}

        kept, outcome, _ = sync_settings(older, "clef", CREDS)

        assert (kept, outcome) == (SHORT, SETTINGS_PULLED)
        assert server.settings_puts == 0

    def test_remote_wins_a_tie(self, server):
        server.settings = sealed(SHORT)
        same_time = {**settings.factory(), "updatedAt": SHORT["updatedAt"]}

        kept, outcome, _ = sync_settings(same_time, "clef", CREDS)

        assert (kept, outcome) == (SHORT, SETTINGS_PULLED)
        assert server.settings_puts == 0

    def test_pushes_the_more_recent_local(self, server):
        server.settings = sealed(SHORT)
        newer = {**settings.factory(), "updatedAt": "2026-03-01T00:00:00Z"}

        kept, outcome, _ = sync_settings(newer, "clef", CREDS)

        assert (kept, outcome) == (newer, SETTINGS_PUSHED)
        assert remote_of(server) == newer

    def test_nothing_to_do_when_equal(self, server):
        server.settings = sealed(SHORT)

        assert sync_settings(SHORT, "clef", CREDS)[1] == SETTINGS_UNCHANGED
        assert server.settings_puts == 0

    def test_unreadable_blob_is_ignored(self, server):
        """Autre clef maîtresse : ni le local ni le distant ne sont écrasés."""
        server.settings = foreign = sealed(SHORT, "autre-clef")
        newer = {**settings.factory(), "updatedAt": "2026-03-01T00:00:00Z"}

        kept, outcome, _ = sync_settings(newer, "clef", CREDS)

        assert (kept, outcome) == (newer, SETTINGS_IGNORED)
        assert server.settings is foreign
        assert server.settings_puts == 0

    def test_incoherent_content_is_ignored(self, server):
        server.settings = sealed({**SHORT, "length": 400, "updatedAt": "2999-01-01T00:00:00Z"})

        kept, outcome, _ = sync_settings(SHORT, "clef", CREDS)

        assert (kept, outcome) == (SHORT, SETTINGS_IGNORED)

    def test_renews_an_expired_token(self, monkeypatch):
        fake = FakeServer(valid_token="expiré")
        monkeypatch.setattr(sync_module, "_request", fake)

        _, outcome, creds = sync_settings(SHORT, "clef", CREDS)

        assert outcome == SETTINGS_PUSHED
        assert creds.access_token == "access-2"


class TestCommandLine:
    def test_defaults_apply_to_a_site_absent_from_the_vault(self, capsys, tmp_path):
        vault = str(tmp_path / "vault.json")
        assert main(["--save-defaults", "-l", "12", "--no-symbols"]) == 0

        pwd = run(capsys, "exemple.fr", "-p", "clef", "--show", "--vault", vault)

        assert pwd == generate_password_v2("exemple.fr", "clef", 12, True, True, False, True)

    def test_explicit_flags_win_for_the_current_command(self, capsys, tmp_path):
        vault = str(tmp_path / "vault.json")
        main(["--save-defaults", "-l", "12", "--no-symbols"])

        pwd = run(capsys, "exemple.fr", "-p", "clef", "--show", "-l", "16", "--symbols",
                  "--vault", vault)

        assert pwd == generate_password_v2("exemple.fr", "clef", 16, True, True, True, True)
        # Rien n'est retenu hors --save-defaults.
        assert settings.load()["length"] == 12

    def test_vault_entry_keeps_its_own_settings(self, capsys, tmp_path):
        vault = tmp_path / "vault.json"
        save({"schema": 1, "updatedAt": "", "entries": [new_entry("google.com")]}, vault)
        main(["--save-defaults", "-l", "12", "--no-symbols"])

        pwd = run(capsys, "google.com", "-p", "clef", "--show", "--vault", str(vault))

        assert pwd == generate_password_v2("google.com", "clef", 20, True, True, True, True)

    def test_saved_entry_starts_from_the_defaults(self, capsys, tmp_path):
        vault = tmp_path / "vault.json"
        main(["--save-defaults", "-l", "12", "--no-symbols"])

        run(capsys, "exemple.fr", "-p", "clef", "--show", "--save", "--vault", str(vault))

        entry = load(vault)["entries"][0]
        assert entry["length"] == 12
        assert entry["charset"]["symbols"] is False

    def test_save_defaults_builds_on_the_current_ones(self):
        main(["--save-defaults", "--no-symbols"])
        main(["--save-defaults", "-l", "30"])

        current = settings.load()
        assert current["length"] == 30
        assert current["charset"]["symbols"] is False

    def test_save_defaults_refuses_out_of_bounds(self, capsys, french):
        assert main(["--save-defaults", "-l", "2"]) == 1
        assert "4 et 40" in capsys.readouterr().err
        assert settings.load() == settings.factory()

    def test_shows_the_defaults(self, capsys, french):
        assert main(["--defaults"]) == 0
        assert "20 caractères, aA#1" in capsys.readouterr().out

        main(["--save-defaults", "-l", "12", "--no-symbols"])
        capsys.readouterr()
        main(["--defaults"])
        assert "12 caractères, aA1" in capsys.readouterr().out

    def test_generation_still_needs_a_site_and_a_key(self, capsys):
        with pytest.raises(SystemExit):
            main(["-p", "clef"])
        with pytest.raises(SystemExit):
            main(["google.com"])

    def test_sync_applies_the_account_settings(self, server, capsys, french, tmp_path):
        Credentials(CREDS.endpoint, "access-1", "refresh-0").save()
        server.settings = sealed(SHORT)

        code = main(["-p", "clef", "--sync", "--vault", str(tmp_path / "vault.json")])

        assert code == 0
        assert settings.load() == SHORT
        assert "repris du compte" in capsys.readouterr().err

    def test_sync_pushes_newer_local_settings(self, server, tmp_path):
        Credentials(CREDS.endpoint, "access-1", "refresh-0").save()
        main(["--save-defaults", "-l", "12"])

        main(["-p", "clef", "--sync", "--vault", str(tmp_path / "vault.json")])

        assert remote_of(server)["length"] == 12

    def test_settings_failure_does_not_fail_the_vault_sync(self, monkeypatch, capsys, french, tmp_path):
        fake = FakeServer()

        def without_settings(url, payload=None, token="", method=""):
            if url.endswith("/v1/settings"):
                raise SyncError("404 : Not Found")
            return fake(url, payload, token, method)

        monkeypatch.setattr(sync_module, "_request", without_settings)
        Credentials(CREDS.endpoint, "access-1", "refresh-0").save()
        vault = tmp_path / "vault.json"
        save({"schema": 1, "updatedAt": "", "entries": [new_entry("google.com")]}, vault)

        code = main(["-p", "clef", "--sync", "--vault", str(vault)])

        assert code == 0
        assert fake.rows
        assert "non synchronisés" in capsys.readouterr().err

    def test_settings_file_holds_the_spec_shape(self):
        main(["--save-defaults", "-l", "12"])

        stored = json.loads(settings.settings_path().read_text(encoding="utf-8"))
        assert set(stored) == {"length", "charset", "updatedAt"}
