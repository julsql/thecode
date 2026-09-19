"""Outil d'administration des codes.

Les codes se distribuent à la main : sans cet outil, la table resterait vide et
les codes de parrainage n'existeraient que dans les tests.
"""

from __future__ import annotations

import pytest

from thecode_api.admin import create_code, disable_code, list_codes
from thecode_api.models import Code


def test_a_lifetime_code_is_created_in_upper_case(db_session):
    row = create_code(db_session, "  avie de test ", "lifetime", note="ami")

    # Un code se recopie à la main : la casse et les espaces ne doivent pas
    # décider s'il marche.
    assert row.code == "AVIEDETEST"
    assert row.active is True
    assert row.max_uses == 0


def test_a_referral_code_without_a_coupon_is_refused(db_session):
    """Sinon le filleul paie le plein tarif et personne ne s'en aperçoit."""
    with pytest.raises(ValueError, match="coupon"):
        create_code(db_session, "PARRAIN", "referral")


def test_an_unknown_kind_is_refused(db_session):
    with pytest.raises(ValueError, match="Type inconnu"):
        create_code(db_session, "TRUC", "cadeau")


def test_a_duplicate_is_refused(db_session):
    create_code(db_session, "AVIE", "lifetime")
    with pytest.raises(ValueError, match="existe déjà"):
        create_code(db_session, "avie", "lifetime")


def test_an_expiry_is_stored(db_session):
    row = create_code(db_session, "COURT", "lifetime", expires_in_days=7)
    assert row.expires_at is not None


def test_disabling_keeps_the_row(db_session):
    create_code(db_session, "AVIE", "lifetime")
    row = disable_code(db_session, "avie")

    # Désactivé plutôt que supprimé : qui l'a utilisé reste lisible, et une
    # désactivation se rattrape.
    assert row.active is False
    assert db_session.query(Code).count() == 1


def test_disabling_an_unknown_code_is_refused(db_session):
    with pytest.raises(ValueError, match="inconnu"):
        disable_code(db_session, "JAMAISVU")


def test_the_list_gives_them_back(db_session):
    create_code(db_session, "UN", "lifetime")
    create_code(db_session, "DEUX", "invite")

    assert [row.code for row in list_codes(db_session)] == ["UN", "DEUX"]
