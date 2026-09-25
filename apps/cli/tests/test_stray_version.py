"""Une entrée ne porte pas de version : un « v » résiduel est ignoré.

Toute entrée du carnet dérive en v2. Un champ ``v`` lu (chargement, import,
synchronisation, fusion) est toléré, retiré, et jamais réécrit. Voir
shared/spec/vault-merge.md.
"""

from __future__ import annotations

import json

import pytest

from thecode import sync as sync_module
from thecode.cli import main
from thecode.core import generate_password_v2
from thecode.sync import Credentials, sync
from thecode.transfer import derive_transfer_key, export_vault, import_vault
from thecode.vault import empty_vault, load, merge, new_entry, save


def stray_vault(v: int = 1) -> dict:
    entry = new_entry("google.com", domains=["google.com"], login="moi")
    entry["v"] = v
    return {"schema": 1, "updatedAt": entry["updatedAt"], "entries": [entry]}


def has_v(vault: dict) -> bool:
    return any("v" in e for e in vault["entries"])


def test_new_entry_has_no_version():
    assert "v" not in new_entry("site.fr")


@pytest.mark.parametrize("v", [1, 2, 3])
def test_load_keeps_the_entry_and_drops_v(tmp_path, v):
    path = tmp_path / "vault.json"
    path.write_text(json.dumps(stray_vault(v)), encoding="utf-8")

    loaded = load(path)

    assert len(loaded["entries"]) == 1
    assert not has_v(loaded)


def test_save_never_writes_v_back(tmp_path):
    path = tmp_path / "vault.json"
    path.write_text(json.dumps(stray_vault()), encoding="utf-8")

    save(load(path), path)

    assert not has_v(json.loads(path.read_text(encoding="utf-8")))


def test_import_drops_v():
    imported = import_vault(export_vault(stray_vault(), "clef"), "clef")

    assert len(imported["entries"]) == 1
    assert not has_v(imported)


def test_merge_drops_v():
    merged, _ = merge(empty_vault(), stray_vault())

    assert len(merged["entries"]) == 1
    assert not has_v(merged)


def test_sync_drops_v(monkeypatch):
    key = derive_transfer_key("clef")
    rows = [sync_module._encrypt_entry(e, key) for e in stray_vault()["entries"]]
    pushed: list[dict] = []

    def fake_request(url, payload=None, token="", method=""):
        if payload is None:
            return {"revision": 1, "entries": rows}
        pushed.append(payload)
        return {"revision": 2, "accepted": len(payload["entries"])}

    monkeypatch.setattr(sync_module, "_request", fake_request)
    creds = Credentials("https://example.test/api", "access", "refresh")

    merged, _, _, _ = sync(empty_vault(), "clef", creds)

    assert len(merged["entries"]) == 1
    assert not has_v(merged)
    pushed_entries = [sync_module._decrypt_entry(r, key) for r in pushed[0]["entries"]]
    assert pushed_entries and not any("v" in e for e in pushed_entries)


def test_entry_with_stray_v1_still_derives_v2(tmp_path, capsys):
    path = tmp_path / "vault.json"
    vault = stray_vault(1)
    path.write_text(json.dumps(vault), encoding="utf-8")
    entry = vault["entries"][0]

    assert main(["-p", "clef", "google.com", "--show", "--vault", str(path)]) == 0

    expected = generate_password_v2(
        "google.com",
        "clef",
        entry["length"],
        True,
        True,
        True,
        True,
        login="moi",
        counter=1,
    )
    assert capsys.readouterr().out.strip().splitlines()[-1] == expected
