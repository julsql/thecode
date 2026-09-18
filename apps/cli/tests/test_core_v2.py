"""Algorithme v2, vérifié contre les vecteurs partagés.

La v2 ne remplace pas la v1 : elles coexistent, entrée par entrée. Les vecteurs
v1 restent figés et doivent continuer de passer — sans cela, les mots de passe
déjà en service changeraient.
"""

import json
from pathlib import Path

import pytest

from thecode.core import (
    derive_master_key_v2,
    generate_password,
    generate_password_v2,
    seed_v2,
)

VECTORS = json.loads((Path(__file__).parent / "test-vectors.json").read_text())
V2_CASES = VECTORS["v2"]["cases"]


def run(case):
    cs = case["charset"]
    return generate_password_v2(
        case["site"], case["master"], case["length"],
        cs["lower"], cs["upper"], cs["symbols"], cs["numbers"],
        login=case["login"], counter=case["counter"],
    )


@pytest.mark.parametrize("case", V2_CASES, ids=[c["id"] for c in V2_CASES])
def test_matches_shared_vector(case):
    assert run(case) == case["expected"]


def test_v2_section_is_frozen():
    assert VECTORS["v2"]["status"] == "frozen"


class TestWhatV2Fixes:
    def test_concatenation_collision_is_gone(self):
        """En v1, ("google.com","abc") et ("google.co","mabc") donnent le même
        mot de passe. Les séparateurs nuls l'empêchent."""
        assert generate_password_v2("google.com", "abc") != generate_password_v2(
            "google.co", "mabc"
        )
        # Et le défaut est bien réel en v1 :
        assert generate_password("google.com", "abc", 20, True, True, True, True) == (
            generate_password("google.co", "mabc", 20, True, True, True, True)
        )

    def test_login_changes_the_password(self):
        """Deux comptes sur un même site, sans bricoler le nom du site."""
        master = derive_master_key_v2("clef")
        perso = generate_password_v2("google.com", "clef", master=master)
        pro = generate_password_v2("google.com", "clef", login="pro", master=master)
        assert perso != pro

    def test_counter_rotates_the_password(self):
        """Renouveler un mot de passe sans toucher à la clef maîtresse."""
        master = derive_master_key_v2("clef")
        first = generate_password_v2("google.com", "clef", master=master)
        second = generate_password_v2("google.com", "clef", counter=2, master=master)
        assert first != second
        # Et revenir en arrière redonne exactement le précédent.
        assert generate_password_v2("google.com", "clef", counter=1, master=master) == first

    def test_key_derivation_is_deliberately_slow(self):
        """C'est la correction qui compte : sans KDF, un mot de passe qui fuite
        permet de brute-forcer la clef maîtresse hors ligne."""
        import time

        start = time.perf_counter()
        derive_master_key_v2("clef")
        # 600 000 itérations PBKDF2 : au moins quelques dizaines de ms partout.
        assert time.perf_counter() - start > 0.02


class TestV1StillWorks:
    """La coexistence est le cœur de la migration : casser la v1 changerait
    les mots de passe déjà en service."""

    @pytest.mark.parametrize(
        "case", VECTORS["v1"]["cases"], ids=[c["id"] for c in VECTORS["v1"]["cases"]]
    )
    def test_v1_vectors_are_untouched(self, case):
        cs = case["charset"]
        got = generate_password(
            case["site"], case["master"], case["length"],
            cs["lower"], cs["upper"], cs["symbols"], cs["numbers"],
        )
        assert got == case["expected"]

    def test_v1_and_v2_differ(self):
        v1 = generate_password("google.com", "clef", 20, True, True, True, True)
        v2 = generate_password_v2("google.com", "clef", 20)
        assert v1 != v2


def test_master_key_can_be_reused():
    """Le KDF coûte cher volontairement : on ne le repaie pas par site."""
    master = derive_master_key_v2("clef")
    assert seed_v2(master, "a.com") != seed_v2(master, "b.com")
    assert generate_password_v2("a.com", "clef", master=master) == generate_password_v2(
        "a.com", "ignoree-car-master-fourni", master=master
    )
