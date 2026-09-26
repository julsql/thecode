"""Synchronisation du carnet avec le service chiffré.

Ce qui compte : ce que la machine envoie sur le réseau, et le fait que deux
appareils convergent. Un vrai serveur ne dirait rien de plus et rendrait les
tests lents et instables.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from thecode import sync as sync_module
from thecode.sync import Credentials, SyncError, sync
from thecode.transfer import TransferError, _b64d
from thecode.vault import empty_vault, new_entry

#: Sel de dérivation du compte de test (16 octets, base64url).
KDF_SALT = "AAECAwQFBgcICQoLDA0ODw"
CREDS = Credentials("https://example.test/api", "access-1", "refresh-0", kdf_salt=KDF_SALT)


class FakeServer:
    """Serveur de carnet en mémoire, aux mêmes règles que l'API réelle."""

    def __init__(self, valid_token: str = "access-1", max_entries: int | None = None) -> None:
        self.rows: dict[str, dict] = {}
        #: Plafond du compte, rendu au pull quand il est défini.
        self.max_entries = max_entries
        self.revision = 0
        self.refresh_count = 0
        self.valid_token = valid_token
        #: Tout ce qui est passé sur le réseau, pour vérifier l'absence de clair.
        self.sent: list[str] = []
        #: Réglages par défaut du compte : ``{"nonce", "blob"}``, ou None (204).
        self.settings: dict | None = None
        self.settings_puts = 0
        self.kdf_salt = KDF_SALT
        self.me_calls = 0

    def __call__(self, url, payload=None, token="", method=""):
        if payload is not None:
            self.sent.append(json.dumps(payload, ensure_ascii=False))

        if url.endswith("/v1/auth/refresh"):
            self.refresh_count += 1
            self.valid_token = f"access-{self.refresh_count + 1}"
            return {"access_token": self.valid_token, "refresh_token": "refresh-1"}

        if token != self.valid_token:
            raise SyncError("401 : Jeton expiré")

        if url.endswith("/v1/auth/me"):
            self.me_calls += 1
            return {"plan": "free", "kdf_salt": self.kdf_salt}

        if url.endswith("/v1/settings"):
            if payload is None:
                return self.settings
            assert method == "PUT"
            assert set(payload) == {"nonce", "blob"}
            self.settings = payload
            self.settings_puts += 1
            return None

        if payload is None:
            body = {"revision": self.revision, "entries": list(self.rows.values())}
            if self.max_entries is not None:
                body["max_entries"] = self.max_entries
            return body

        if payload["base_revision"] != self.revision:
            # Écraser reviendrait à perdre en silence ce qu'un autre appareil a
            # écrit entre-temps.
            raise SyncError(f"409 : Le carnet a changé depuis (révision {self.revision})")

        self.revision += 1
        for row in payload["entries"]:
            self.rows[row["entry_id"]] = row
        return {"revision": self.revision, "accepted": len(payload["entries"])}


@pytest.fixture
def server(monkeypatch):
    fake = FakeServer()
    monkeypatch.setattr(sync_module, "_request", fake)
    return fake


def vault_with(site_key: str, login: str) -> dict:
    vault = empty_vault()
    vault["entries"].append(new_entry(site_key, domains=[site_key], login=login))
    return vault


def test_sends_nothing_readable(server):
    sync(vault_with("banque-secrete.fr", "utilisateur"), "clef", CREDS)

    assert server.sent
    for body in server.sent:
        # Le serveur ne doit rien apprendre : ni le site, ni l'identifiant.
        assert "banque-secrete" not in body
        assert "utilisateur" not in body


def test_two_devices_converge(server):
    phone, _, _, _ = sync(vault_with("google.com", "moi"), "clef", CREDS)
    laptop, _, _, _ = sync(vault_with("github.com", "julsql"), "clef", CREDS)
    phone, _, _, _ = sync(phone, "clef", CREDS)

    assert len(laptop["entries"]) == 2
    assert {e["siteKey"] for e in phone["entries"]} == {"google.com", "github.com"}


def test_pushes_only_the_oldest_beyond_the_cap(monkeypatch):
    fake = FakeServer(max_entries=2)
    monkeypatch.setattr(sync_module, "_request", fake)
    vault = empty_vault()
    for site, created in [
        ("recent.fr", "2026-03-01T00:00:00Z"),
        ("ancien.fr", "2026-01-01T00:00:00Z"),
        ("moyen.fr", "2026-02-01T00:00:00Z"),
    ]:
        vault["entries"].append({**new_entry(site), "createdAt": created})

    merged, _, local_only, _ = sync(vault, "clef", CREDS)

    by_site = {e["siteKey"]: e["id"] for e in vault["entries"]}
    pushed = [row["entry_id"] for row in json.loads(fake.sent[0])["entries"]]
    assert sorted(pushed) == sorted([by_site["ancien.fr"], by_site["moyen.fr"]])
    # L'entrée en trop reste dans le carnet local.
    assert local_only == 1
    assert len(merged["entries"]) == 3


def test_pushes_everything_without_a_cap(server):
    vault = empty_vault()
    vault["entries"] += [new_entry(f"site-{i}.fr") for i in range(3)]

    _, _, local_only, _ = sync(vault, "clef", CREDS)

    assert local_only == 0
    assert len(json.loads(server.sent[0])["entries"]) == 3


def test_tombstone_propagates(server):
    phone, _, _, _ = sync(vault_with("google.com", "moi"), "clef", CREDS)
    deleted_id = phone["entries"][0]["id"]
    phone["entries"][0]["deleted"] = True
    phone["entries"][0]["updatedAt"] = "2999-01-01T00:00:00Z"
    sync(phone, "clef", CREDS)

    laptop, _, _, _ = sync(vault_with("google.com", "moi"), "clef", CREDS)
    propagated = next(e for e in laptop["entries"] if e["id"] == deleted_id)
    assert propagated["deleted"] is True


def test_absent_deleted_stays_absent(server):
    """La normalisation qui fait converger les cinq implémentations.

    Écrire ``deleted: false`` changerait la représentation canonique qui
    départage les écritures simultanées : chaque appareil désignerait un autre
    gagnant, et les carnets ne convergeraient jamais.
    """
    sync(vault_with("google.com", "moi"), "clef", CREDS)
    merged, _, _, _ = sync(empty_vault(), "clef", CREDS)

    assert "deleted" not in merged["entries"][0]


def test_refuses_another_master_key(server):
    sync(vault_with("google.com", "moi"), "clef", CREDS)

    with pytest.raises(Exception, match="clef maîtresse"):
        sync(empty_vault(), "mauvaise", CREDS)


def test_renews_an_expired_token(monkeypatch, tmp_path):
    fake = FakeServer(valid_token="expiré")
    monkeypatch.setattr(sync_module, "_request", fake)
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))

    _, _, _, creds = sync(vault_with("google.com", "moi"), "clef", CREDS)

    assert fake.refresh_count == 1
    assert creds.access_token == "access-2"
    assert fake.revision == 1


def test_reports_a_stale_revision(monkeypatch):
    pushed = []

    def stale(url, payload=None, token="", method=""):
        if payload is None:
            return {"revision": 3, "entries": []}
        pushed.append(payload)
        # Un autre appareil a écrit entre le pull et le push.
        raise SyncError("409 : Le carnet a changé depuis (révision 4)")

    monkeypatch.setattr(sync_module, "_request", stale)

    # Refuser vaut mieux qu'écraser : la fusion doit être refaite.
    with pytest.raises(SyncError, match="409"):
        sync(empty_vault(), "clef", CREDS)
    assert pushed[0]["base_revision"] == 3


def _vector() -> dict:
    return json.loads((Path(__file__).parent / "sync-row.json").read_text(encoding="utf-8"))


def _vector_key(vector: dict) -> bytes:
    return sync_module.derive_sync_key(vector["masterKey"], _b64d(vector["kdfSalt"]))


def test_interoperates_with_the_shared_vector():
    """Une ligne produite ici doit être lisible partout, et réciproquement."""
    vector = _vector()
    key = _vector_key(vector)

    assert key.hex() == vector["derivedSyncHex"]
    assert sync_module._decrypt_entry(vector["row"], key) == vector["entry"]
    assert vector["row"]["entry_id"] == vector["entry"]["id"]


def test_shared_settings_vector():
    vector = _vector()
    key = _vector_key(vector)

    assert sync_module.open_settings(vector["settings"]["sealed"], key) == vector["settings"]["value"]


@pytest.mark.parametrize("case", _vector()["rejected"], ids=lambda case: case["name"])
def test_shared_negative_vectors(case):
    """Chaque cas doit échouer : blob déplacé, identifiant incohérent, autre usage."""
    vector = _vector()
    key = _vector_key(vector)

    with pytest.raises(TransferError):
        if case["as"] == "settings":
            sync_module.open_settings(case["row"], key)
        else:
            sync_module._decrypt_entry(case["row"], key)


def test_key_depends_on_the_account_salt():
    """Même clef maîtresse, deux comptes : deux clefs différentes."""
    one = sync_module.derive_sync_key("clef", bytes(16))
    other = sync_module.derive_sync_key("clef", bytes([1]) * 16)
    assert one != other


def test_a_blob_moved_to_another_entry_is_refused(server):
    """Le serveur ne peut pas échanger les blobs de deux entrées."""
    vault = empty_vault()
    vault["entries"] += [new_entry("google.com"), new_entry("github.com")]
    sync(vault, "clef", CREDS)

    first, second = list(server.rows)
    server.rows[first] = {**server.rows[second], "entry_id": first}

    with pytest.raises(TransferError):
        sync(empty_vault(), "clef", CREDS)


def test_settings_blob_is_not_readable_as_an_entry():
    key = sync_module.derive_sync_key("clef", bytes(16))
    entry = new_entry("google.com")
    sealed = sync_module.seal_settings(entry, key)

    with pytest.raises(TransferError):
        sync_module._decrypt_entry({"entry_id": entry["id"], **sealed}, key)


def test_fetches_the_salt_when_the_session_lacks_it(server, monkeypatch, tmp_path):
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))
    bare = Credentials(CREDS.endpoint, "access-1", "refresh-0")

    _, _, _, creds = sync(vault_with("google.com", "moi"), "clef", bare)

    assert server.me_calls == 1
    assert creds.kdf_salt == KDF_SALT
    assert Credentials.load().kdf_salt == KDF_SALT


def test_refuses_to_sync_without_a_salt(server, monkeypatch, tmp_path):
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))
    server.kdf_salt = ""

    with pytest.raises(SyncError, match="sel"):
        sync(empty_vault(), "clef", Credentials(CREDS.endpoint, "access-1", "refresh-0"))
    assert server.sent == []


def test_login_keeps_the_account_salt(monkeypatch, tmp_path):
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))

    def fake(url, payload=None, token="", method=""):
        assert url.endswith("/v1/auth/login")
        return {"access_token": "a", "refresh_token": "r", "kdf_salt": KDF_SALT}

    monkeypatch.setattr(sync_module, "_request", fake)
    sync_module.login("https://example.test", "moi@example.fr", "secret")

    assert Credentials.load().kdf_salt == KDF_SALT
