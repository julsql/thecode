"""Le carnet n'accepte que la v2 : vecteur partagé vault-fixtures/v2-only.json.

Chaque chemin de lecture (chargement, import, synchronisation, fusion) doit ne
garder que les entrées de ``expectedIds``. Voir shared/spec/vault-merge.md.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from thecode import sync as sync_module
from thecode.cli import main
from thecode.sync import Credentials, sync
from thecode.transfer import derive_transfer_key, export_vault, import_vault
from thecode.vault import empty_vault, load, merge, new_entry, save

FIXTURE = json.loads((Path(__file__).parent / "v2-only.json").read_text(encoding="utf-8"))
EXPECTED = sorted(FIXTURE["expectedIds"])


def fixture_vault() -> dict:
    return copy.deepcopy(FIXTURE["vault"])


def ids(vault: dict) -> list[str]:
    return sorted(e["id"] for e in vault["entries"])


def test_fixture_mixes_versions():
    # Sans v1 ni version future, le vecteur ne prouverait rien.
    assert {e["v"] for e in FIXTURE["vault"]["entries"]} == {1, 2, 3}


def test_load_keeps_only_v2(tmp_path):
    path = tmp_path / "vault.json"
    path.write_text(json.dumps(FIXTURE["vault"]), encoding="utf-8")

    assert ids(load(path)) == EXPECTED


def test_import_keeps_only_v2():
    payload = export_vault(fixture_vault(), "clef")

    assert ids(import_vault(payload, "clef")) == EXPECTED


def test_cli_import_keeps_only_v2(tmp_path):
    path = tmp_path / "vault.json"
    payload = export_vault(fixture_vault(), "clef")

    assert main(["-p", "clef", "x", "--import", payload, "--vault", str(path)]) == 0
    raw = json.loads(path.read_text(encoding="utf-8"))
    assert ids(raw) == EXPECTED


def test_merge_keeps_only_v2():
    merged, _ = merge(empty_vault(), fixture_vault())
    assert ids(merged) == EXPECTED

    merged, _ = merge(fixture_vault(), empty_vault())
    assert ids(merged) == EXPECTED


def test_sync_keeps_only_v2(monkeypatch):
    key = derive_transfer_key("clef")
    rows = [sync_module._encrypt_entry(e, key) for e in fixture_vault()["entries"]]
    pushed: list[dict] = []

    def fake_request(url, payload=None, token="", method=""):
        if payload is None:
            return {"revision": 1, "entries": rows}
        pushed.append(payload)
        return {"revision": 2, "accepted": len(payload["entries"])}

    monkeypatch.setattr(sync_module, "_request", fake_request)
    creds = Credentials("https://example.test/api", "access", "refresh")

    merged, _, _ = sync(empty_vault(), "clef", creds)

    assert ids(merged) == EXPECTED
    # Rien d'autre que la v2 ne repart vers le serveur.
    assert sorted(r["entry_id"] for r in pushed[0]["entries"]) == EXPECTED


def test_save_never_writes_a_dropped_entry(tmp_path):
    path = tmp_path / "vault.json"
    path.write_text(json.dumps(FIXTURE["vault"]), encoding="utf-8")

    save(load(path), path)

    assert ids(json.loads(path.read_text(encoding="utf-8"))) == EXPECTED


@pytest.mark.parametrize("version", [1, 3])
def test_new_entry_refuses_other_versions(version):
    with pytest.raises(ValueError):
        new_entry("site.fr", version=version)


def test_new_entry_is_v2():
    assert new_entry("site.fr")["v"] == 2
