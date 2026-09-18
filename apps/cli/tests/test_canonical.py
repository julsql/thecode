"""Canonicalisation des hostnames, vérifiée contre le référentiel partagé.

Fichier synchronisé depuis shared/ ; ne jamais l'éditer directement.
"""

import json
from pathlib import Path

import pytest
from thecode.canonical import (
    canonical_site,
    load_public_suffixes,
    registrable_domain,
)

SPEC = json.loads((Path(__file__).parent / "canonical-site-cases.json").read_text())
CASES = SPEC["cases"]
IMPL = "cli"


def test_spec_is_readable():
    assert SPEC["schema"] == 1
    assert CASES


def test_public_suffix_list_is_shipped():
    """Sans la PSL, canonical_site refuse de canonicaliser : on vérifie qu'elle
    est bien livrée avec le paquet, et complète."""
    suffixes = load_public_suffixes()
    assert len(suffixes) > 5000
    # Suffixes privés, précisément ceux qu'une liste réduite ignore.
    assert "github.io" in suffixes
    assert "s3.amazonaws.com" in suffixes


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_matches_shared_reference(case):
    want = case.get("divergences", {}).get(IMPL, case["expected"])
    assert registrable_domain(case["hostname"], load_public_suffixes()) == want


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("https://www.google.com/login?next=/x", "google.com"),
        ("HTTPS://WWW.Example.FR", "example.fr"),
        ("https://user@example.com:8443/foo", "example.com"),
        ("shop.example.co.uk", "example.co.uk"),
        ("foo.github.io", "foo.github.io"),
    ],
)
def test_free_form_input(raw, expected):
    assert canonical_site(raw) == expected


@pytest.mark.parametrize("label", ["serveur perso", "banque", ""])
def test_labels_are_left_alone(label):
    """Le champ est libre : quelqu'un peut s'en servir comme d'une étiquette.
    Transformer ces valeurs changerait son mot de passe."""
    assert canonical_site(label) == label
