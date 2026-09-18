"""Empreinte de la clef maîtresse."""

import pytest

from thecode.fingerprint import ALPHABET, LENGTH, fingerprint, fingerprint_color


def test_is_stable():
    assert fingerprint("clef") == fingerprint("clef")


@pytest.mark.parametrize(
    "a,b",
    [
        ("clef", "clef "),  # espace en trop
        ("clef", "Clef"),  # majuscule
        ("clef", "clefs"),  # caractère en trop
        ("clef", "cled"),  # touche voisine
    ],
)
def test_catches_a_typo(a, b):
    """C'est tout l'intérêt : une faute de frappe doit sauter aux yeux."""
    assert fingerprint(a) != fingerprint(b)


def test_uses_an_unambiguous_alphabet():
    """Une empreinte se lit à voix haute : ni 0/O, ni 1/I/L."""
    for forbidden in "01OIL":
        assert forbidden not in ALPHABET
    assert len(fingerprint("clef")) == LENGTH
    assert all(c in ALPHABET for c in fingerprint("clef"))


def test_reveals_nothing_of_the_key():
    """Trois caractères ne disent rien de la clef elle-même."""
    fp = fingerprint("ma-super-clef-secrete")
    assert "clef" not in fp.lower()
    assert "secret" not in fp.lower()


def test_empty_key_has_no_fingerprint():
    assert fingerprint("") == ""
    assert fingerprint_color("") == ("", "")


def test_colour_is_stable_and_named():
    name, hex_code = fingerprint_color("clef")
    assert name
    assert hex_code.startswith("#")
    assert fingerprint_color("clef") == (name, hex_code)
