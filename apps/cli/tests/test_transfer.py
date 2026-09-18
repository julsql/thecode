"""Export et import chiffrés du carnet."""

import json

import pytest

from thecode import vault
from thecode.transfer import PREFIX, TransferError, export_vault, import_vault


@pytest.fixture
def filled_vault():
    v = vault.empty_vault()
    v["entries"].append(
        vault.new_entry("google.com", domains=["google.com", "google.fr"], login="moi@example.com")
    )
    return v


def test_round_trip(filled_vault):
    payload = export_vault(filled_vault, "clef")
    assert import_vault(payload, "clef") == filled_vault


def test_payload_is_opaque(filled_vault):
    """Une photo d'écran ne doit rien révéler : ni les sites, ni les logins."""
    payload = export_vault(filled_vault, "clef")
    assert "google" not in payload
    assert "moi@example.com" not in payload
    assert payload.startswith(f"{PREFIX}.")


def test_wrong_key_is_rejected(filled_vault):
    payload = export_vault(filled_vault, "clef")
    with pytest.raises(TransferError, match="clef maîtresse"):
        import_vault(payload, "mauvaise-clef")


def test_tampering_is_detected(filled_vault):
    """AES-GCM authentifie : un octet modifié doit faire échouer, pas produire
    un carnet corrompu."""
    payload = export_vault(filled_vault, "clef")
    head, nonce, cipher = payload.split(".")
    altered = cipher[:-4] + ("AAAA" if cipher[-4:] != "AAAA" else "BBBB")
    with pytest.raises(TransferError):
        import_vault(f"{head}.{nonce}.{altered}", "clef")


def test_unknown_version_is_refused(filled_vault):
    """Interpréter un format inconnu au hasard serait pire que refuser."""
    payload = export_vault(filled_vault, "clef")
    _, nonce, cipher = payload.split(".")
    with pytest.raises(TransferError, match="inconnue"):
        import_vault(f"TC9.{nonce}.{cipher}", "clef")


def test_malformed_payload_is_refused():
    with pytest.raises(TransferError, match="Format"):
        import_vault("n-importe-quoi", "clef")


def test_nonce_is_never_reused(filled_vault):
    """Réutiliser un nonce avec la même clef casse AES-GCM."""
    nonces = {export_vault(filled_vault, "clef").split(".")[1] for _ in range(20)}
    assert len(nonces) == 20


def test_compression_keeps_a_large_vault_scannable(filled_vault):
    """Un QR code plafonne à ~2,9 Ko : cinquante entrées doivent y tenir."""
    big = vault.empty_vault()
    for i in range(50):
        big["entries"].append(vault.new_entry(f"site{i}.example.com", login=f"user{i}@example.com"))
    payload = export_vault(big, "clef")
    raw = len(json.dumps(big))
    assert len(payload) < 2900, f"{len(payload)} octets, brut {raw}"


def test_import_does_not_replace_the_local_vault(filled_vault):
    """Un import qui écrase effacerait les entrées créées ici : on fusionne."""
    local = vault.empty_vault()
    local["entries"].append(vault.new_entry("github.com"))

    incoming = import_vault(export_vault(filled_vault, "clef"), "clef")
    merged, conflicts = vault.merge(local, incoming)

    keys = {e["siteKey"] for e in merged["entries"]}
    assert keys == {"github.com", "google.com"}
    assert conflicts == []


def test_shared_interoperability_vector():
    """Un carnet exporté sur un appareil doit être lisible sur tous les autres.

    Ce vecteur est partagé : chaque implémentation le déchiffre et doit
    retrouver exactement le même carnet. Sans lui, deux plateformes pourraient
    diverger sur la compression ou l'encodage sans que rien ne le signale.

    Fichier synchronisé depuis shared/ ; ne jamais l'éditer directement.
    """
    from pathlib import Path

    spec = json.loads((Path(__file__).parent / "transfer-vector.json").read_text())
    assert import_vault(spec["payload"], spec["masterKey"]) == spec["vault"]
