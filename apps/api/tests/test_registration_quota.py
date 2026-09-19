"""Inscription en mode quota.

Les premiers comptes se créent librement ; au-delà il faut un code de
parrainage. C'est là que passera l'abonnement, d'où une limite comptée sur les
comptes réellement existants plutôt que sur un compteur à part : un compte
supprimé doit libérer sa place.
"""

from __future__ import annotations

import pytest

from thecode_api.models import Account


@pytest.fixture
def quota(settings):
    """Serveur en mode quota, trois places libres.

    La fixture `settings` du conftest remplace `get_settings` dans chaque
    module : la route l'appelle directement, une surcharge de dépendance
    n'aurait aucun effet.
    """
    settings.registration_mode = "quota"
    settings.free_accounts = 3
    settings.invite_code = "parrainage"
    return settings


def register(client, email, code=""):
    return client.post(
        "/v1/auth/register",
        json={"email": email, "password": "mot-de-passe-de-test", "invite_code": code},
    )


def test_the_first_accounts_need_no_code(client, quota):
    for i in range(3):
        assert register(client, f"libre{i}@exemple.fr").status_code == 201


def test_beyond_the_quota_a_code_is_required(client, quota):
    for i in range(3):
        register(client, f"libre{i}@exemple.fr")

    refused = register(client, "trop@exemple.fr")
    assert refused.status_code == 403
    # Le message dit « parrainage » : parler d'invitation ici enverrait
    # chercher autre chose.
    assert "parrainage" in refused.json()["detail"].lower()


def test_the_code_unlocks_beyond_the_quota(client, quota):
    for i in range(3):
        register(client, f"libre{i}@exemple.fr")

    assert register(client, "parraine@exemple.fr", code="parrainage").status_code == 201


def test_a_wrong_code_is_refused(client, quota):
    for i in range(3):
        register(client, f"libre{i}@exemple.fr")

    assert register(client, "essai@exemple.fr", code="au-hasard").status_code == 403


def test_the_state_says_what_the_form_must_ask(client, quota):
    state = client.get("/v1/auth/registration").json()
    assert state == {
        "open": True,
        "needsCode": False,
        "freeSlots": 3,
        # Vide : la connexion Google n'est pas configurée dans les tests, et le
        # site doit alors ne pas proposer le bouton plutôt que d'en afficher un
        # qui échouerait.
        "googleClientId": "",
    }

    register(client, "libre0@exemple.fr")
    assert client.get("/v1/auth/registration").json()["freeSlots"] == 2

    for i in range(1, 3):
        register(client, f"libre{i}@exemple.fr")

    full = client.get("/v1/auth/registration").json()
    assert full["freeSlots"] == 0
    assert full["needsCode"] is True


def test_a_freed_place_is_reusable(client, quota, db_session):
    for i in range(3):
        register(client, f"libre{i}@exemple.fr")
    assert register(client, "trop@exemple.fr").status_code == 403

    # Le compte est compté sur les comptes existants : en supprimer un doit
    # rouvrir une place, sans intervention.
    db_session.query(Account).filter(Account.email == "libre0@exemple.fr").delete()
    db_session.commit()

    assert register(client, "trop@exemple.fr").status_code == 201


def test_the_quota_mode_is_accepted_by_the_configuration(monkeypatch):
    """Le mode doit être reconnu, sinon le service refuse de démarrer.

    Ajouter un mode sans l'inscrire dans ce contrôle bloque le déploiement au
    conteneur de migration, là où l'erreur est la moins visible.
    """
    from thecode_api.config import get_settings

    monkeypatch.setenv("THECODE_REGISTRATION_MODE", "quota")
    monkeypatch.setenv("THECODE_INVITE_CODE", "parrainage")
    monkeypatch.setenv("THECODE_JWT_SECRET", "assez-long-pour-le-test-0123456789")
    get_settings.cache_clear()
    try:
        assert get_settings().registration_quota
    finally:
        get_settings.cache_clear()


def test_quota_without_a_code_is_refused(monkeypatch):
    """Sinon plus personne ne pourrait s'inscrire une fois les places prises."""
    from thecode_api.config import get_settings

    monkeypatch.setenv("THECODE_REGISTRATION_MODE", "quota")
    monkeypatch.setenv("THECODE_INVITE_CODE", "")
    monkeypatch.setenv("THECODE_JWT_SECRET", "assez-long-pour-le-test-0123456789")
    get_settings.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="quota"):
            get_settings()
    finally:
        get_settings.cache_clear()
