"""Contrôles de cohérence de la configuration.

Ces contrôles tournent au démarrage, donc dans le conteneur de migration en
production : c'est l'endroit où une erreur est la moins visible — le
déploiement reste bloqué pendant que l'ancienne version continue de servir.
D'où des messages qui disent ce qui manque et pourquoi ça compte.
"""

from __future__ import annotations

import pytest

from thecode_api.config import get_settings


@pytest.fixture(autouse=True)
def base_env(monkeypatch):
    monkeypatch.setenv("THECODE_REGISTRATION_MODE", "open")
    monkeypatch.setenv("THECODE_JWT_SECRET", "assez-long-pour-le-test-0123456789")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_without_stripe_the_service_starts(monkeypatch):
    settings = get_settings()
    assert settings.billing_enabled is False


def test_a_complete_stripe_configuration_is_accepted(monkeypatch):
    monkeypatch.setenv("THECODE_STRIPE_SECRET_KEY", "sk_test")
    monkeypatch.setenv("THECODE_STRIPE_PRICE_ID", "price_test")
    monkeypatch.setenv("THECODE_STRIPE_WEBHOOK_SECRET", "whsec_test")
    get_settings.cache_clear()

    assert get_settings().billing_enabled is True


def test_stripe_without_plans_does_not_open_the_billing(monkeypatch):
    """Facturer alors que tout est ouvert reviendrait à faire payer ce que les
    autres ont gratuitement."""
    monkeypatch.setenv("THECODE_STRIPE_SECRET_KEY", "sk_test")
    monkeypatch.setenv("THECODE_STRIPE_PRICE_ID", "price_test")
    monkeypatch.setenv("THECODE_STRIPE_WEBHOOK_SECRET", "whsec_test")
    monkeypatch.setenv("THECODE_PLANS_ENABLED", "false")
    get_settings.cache_clear()

    assert get_settings().billing_enabled is False


def test_plans_apply_without_any_way_to_pay(monkeypatch):
    """L'état du service aujourd'hui : les plafonds comptent, et se lèvent par
    code. Deux questions séparées, et les confondre reviendrait à annoncer un
    prix pour quelque chose qui ne se vend pas."""
    settings = get_settings()

    assert settings.plans_enabled is True
    assert settings.billing_enabled is False


def test_a_half_configured_stripe_is_refused(monkeypatch):
    """Le pire des deux mondes : le paiement passe, l'abonnement ne remonte pas.

    Sans secret de webhook, Stripe encaisse et le service n'en sait rien : le
    compte reste gratuit alors qu'il est payé.
    """
    monkeypatch.setenv("THECODE_STRIPE_SECRET_KEY", "sk_test")
    monkeypatch.setenv("THECODE_STRIPE_PRICE_ID", "price_test")
    get_settings.cache_clear()

    with pytest.raises(RuntimeError, match="Stripe"):
        get_settings()


def test_requiring_verification_without_sending_mail_is_refused(monkeypatch):
    """Sinon plus personne ne reçoit son lien, et plus aucun compte ne sert."""
    monkeypatch.setenv("THECODE_REQUIRE_EMAIL_VERIFICATION", "true")
    get_settings.cache_clear()

    with pytest.raises(RuntimeError, match="vérification"):
        get_settings()


def test_an_unknown_mail_transport_is_refused(monkeypatch):
    monkeypatch.setenv("THECODE_MAIL_TRANSPORT", "pigeon")
    get_settings.cache_clear()

    with pytest.raises(RuntimeError, match="MAIL_TRANSPORT"):
        get_settings()
