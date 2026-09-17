"""Conformite aux vecteurs partages (shared/test-vectors.json).

Garde-fou garantissant que les 6 implementations de TheCode produisent
exactement le meme mot de passe. Une divergence d'un caractere = un
utilisateur qui perd l'acces a ses comptes.

La section v1 est FIGEE : ces valeurs sont en production. Si un test echoue
ici, ce n'est jamais le vecteur qu'il faut corriger.

Le fichier lu est une copie synchronisee depuis shared/ (scripts/sync-shared.sh) ;
ne jamais l'editer directement.
"""

import json
from pathlib import Path

import pytest

from thecode.core import build_charset, generate_password

VECTORS = json.loads((Path(__file__).parent / "test-vectors.json").read_text())
CASES = VECTORS["v1"]["cases"]


def test_vectors_loaded():
    assert VECTORS["schema"] == 1
    assert VECTORS["v1"]["status"] == "frozen"
    assert CASES


def test_alphabets_match_shared_spec():
    a = VECTORS["v1"]["alphabets"]
    assert build_charset(True, True, True, True) == [
        a["lower"],
        a["upper"],
        a["symbols"],
        a["numbers"],
    ]


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_password_matches_shared_vector(case):
    cs = case["charset"]
    got = generate_password(
        case["site"],
        case["master"],
        case["length"],
        cs["lower"],
        cs["upper"],
        cs["symbols"],
        cs["numbers"],
    )
    assert got == case["expected"]


def test_v1_concatenation_collision_is_documented():
    """Comportement reel de la v1, conserve tel quel. Corrige en v2."""
    a = next(c for c in CASES if c["id"] == "collision-a")
    b = next(c for c in CASES if c["id"] == "collision-b")
    assert a["expected"] == b["expected"]
