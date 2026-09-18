"""Grille de variantes."""

from thecode.core import generate_password
from thecode.variants import (
    COMMON_CHARSETS,
    COMMON_LENGTHS,
    entry_from_variant,
    variants,
)


def test_lists_plausible_candidates():
    got = variants("google.com", "clef")
    assert len(got) == len(COMMON_LENGTHS) * len(COMMON_CHARSETS)


def test_most_likely_comes_first():
    """20 caractères avec tout : le réglage par défaut, donc le plus probable."""
    first = variants("google.com", "clef")[0]
    assert first.length == 20
    assert first.charset_label == "tout"


def test_the_real_password_is_in_the_grid():
    """Le cas d'usage : un compte créé en 16 sans symboles, réglage oublié."""
    lost = generate_password(
        site="google.com", key="clef", length=16,
        use_lower=True, use_upper=True, use_symbols=False, use_numbers=True,
    )
    assert any(v.password == lost for v in variants("google.com", "clef"))


def test_legacy_site_forms_are_covered():
    """Après un changement de canonicalisation, l'ancienne forme reste
    atteignable : c'est ce qui rend la migration récupérable."""
    old = generate_password(
        site="www.google.com", key="clef", length=20,
        use_lower=True, use_upper=True, use_symbols=True, use_numbers=True,
    )
    got = variants("google.com", "clef", legacy_sites=["www.google.com"])
    assert any(v.password == old for v in got)


def test_no_duplicates():
    got = variants("google.com", "clef")
    assert len({v.password for v in got}) == len(got)


def test_each_variant_says_how_it_was_made():
    for v in variants("google.com", "clef"):
        assert str(v.length) in v.describe()
        assert v.charset_label in v.describe()


def test_a_recognised_variant_becomes_a_vault_entry():
    """Une fois le bon mot de passe reconnu, on l'enregistre pour ne plus
    jamais avoir à le chercher."""
    v = next(x for x in variants("google.com", "clef") if x.length == 16)
    entry = entry_from_variant(v, label="Google")
    assert entry["siteKey"] == "google.com"
    assert entry["length"] == 16
    assert entry["charset"] == v.charset
