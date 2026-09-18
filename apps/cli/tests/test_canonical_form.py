"""Forme canonique d'une entrée.

Elle départage deux écritures au même horodatage. Deux implémentations qui
n'écrivent pas la même chaîne désignent un gagnant différent et ne convergent
jamais — les tests par plateforme ont déjà laissé passer exactement ce genre
d'écart, d'où le fichier partagé.

Spécification : shared/spec/vault-merge.md
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from thecode.vault import _canonical

FIXTURE = json.loads(
    (Path(__file__).parent / "canonical-entries.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", FIXTURE["cases"], ids=lambda c: c["name"])
def test_matches_the_shared_fixture(case):
    assert _canonical(case["entry"]) == case["canonical"]


def test_is_compact_and_sorted_at_every_level():
    entry = FIXTURE["cases"][0]["entry"]
    out = _canonical(entry)

    # Compacte : un espace après « : » suffirait à faire diverger.
    assert ", " not in out
    assert '": ' not in out
    # charset trié, et non vidé : JSON.stringify avec un tableau de clefs
    # vidait l'objet imbriqué côté navigateur.
    assert '"charset":{"lower":true,"numbers":true,"symbols":true,"upper":true}' in out


def test_drops_a_false_deleted_but_keeps_a_true_one():
    kept = next(c for c in FIXTURE["cases"] if c["name"] == "deleted-vrai-conserve")
    dropped = next(c for c in FIXTURE["cases"] if c["name"] == "deleted-faux-retire")

    assert '"deleted":true' in _canonical(kept["entry"])
    assert "deleted" not in _canonical(dropped["entry"])


def test_leaves_slashes_and_accents_as_they_are():
    case = next(c for c in FIXTURE["cases"] if c["name"] == "accents-et-slash")
    out = _canonical(case["entry"])

    # org.json échappe « / », et un encodeur en \uXXXX casserait l'égalité.
    assert "site.fr/chemin" in out
    assert "\\u" not in out
    assert "Café" in out
