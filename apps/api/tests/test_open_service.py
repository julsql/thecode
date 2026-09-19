"""Service ouvert : les offres ne s'appliquent pas.

C'est l'état par défaut, et celui du service tant que rien n'est vendu. Tout le
monde a tout, l'abonnement est dormant, et personne ne se retrouve bloqué
devant un bouton de paiement qui ne mène nulle part.

Ce qui reste vrai dans cet état est ce que ces tests fixent : aucun plafond,
aucune souscription possible, et les codes qui continuent de fonctionner — ils
sont le seul moyen de marquer un compte en offre complète, et donc de vérifier
ce que ce marquage change le jour où les offres s'appliqueront.
"""

from __future__ import annotations

import base64

import pytest

from thecode_api.models import Account, Code

PASSWORD = "mot-de-passe-de-test"


@pytest.fixture
def ouvert(settings):
    settings.plans_enabled = False
    settings.free_max_entries = 2
    settings.free_max_devices = 1
    return settings


def register(client, email="julie@exemple.fr", code=""):
    return client.post(
        "/v1/auth/register",
        json={"email": email, "password": PASSWORD, "invite_code": code},
    )


def bearer(response):
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def entry(entry_id: str) -> dict:
    return {
        "entry_id": entry_id,
        "nonce": base64.urlsafe_b64encode(b"x" * 12).decode().rstrip("="),
        "blob": base64.urlsafe_b64encode(b"y" * 32).decode().rstrip("="),
        "deleted": False,
    }


def test_the_free_caps_do_not_apply(client, ouvert, sent_emails):
    created = register(client)

    # Trois entrées alors que le plafond gratuit en autorise deux : rien n'est
    # vendu, donc rien n'est retenu.
    response = client.post(
        "/v1/vault",
        json={"base_revision": 0, "entries": [entry("a"), entry("b"), entry("c")]},
        headers=bearer(created),
    )
    assert response.status_code == 200


def test_a_second_device_can_sign_in(client, ouvert, sent_emails):
    register(client)

    second = client.post(
        "/v1/auth/login",
        json={"email": "julie@exemple.fr", "password": PASSWORD, "device_label": "téléphone"},
    )
    assert second.status_code == 200


def test_the_account_reports_the_full_plan(client, ouvert, sent_emails):
    """Les clients lisent l'offre pour décider ce qu'ils proposent.

    Le compteur doit donc marcher pour tout le monde, sans qu'aucun d'eux ait
    à connaître la raison.
    """
    created = register(client)

    me = client.get("/v1/auth/me", headers=bearer(created)).json()
    assert me["plan"] == "pro"
    assert me["plans_enforced"] is False


def test_nothing_can_be_subscribed(client, ouvert, sent_emails):
    created = register(client)

    response = client.post("/v1/billing/checkout", json={}, headers=bearer(created))

    assert response.status_code == 503
    assert "gratuitement" in response.json()["detail"]


def test_the_public_prices_say_so(client, ouvert):
    body = client.get("/v1/billing/plans").json()

    assert body["plans_enforced"] is False
    assert body["billing_available"] is False


def test_a_code_still_marks_the_account(client, ouvert, db_session, sent_emails):
    """Le seul moyen d'être en offre complète tant que rien n'est vendu.

    C'est ce qui permet de vérifier, sur un vrai compte, ce que l'offre
    changera le jour où elle s'appliquera.
    """
    db_session.add(Code(code="AVIE", kind="lifetime"))
    db_session.commit()

    created = register(client, code="AVIE")
    me = client.get("/v1/auth/me", headers=bearer(created)).json()

    assert me["plan_source"] == "lifetime"
    assert me["subscription_status"] == "lifetime"


def test_turning_the_plans_on_restores_the_caps(client, settings, db_session, sent_emails):
    """Une seule variable sépare les deux états."""
    settings.plans_enabled = False
    settings.free_max_entries = 2
    created = register(client)
    auth = bearer(created)

    assert (
        client.post(
            "/v1/vault",
            json={"base_revision": 0, "entries": [entry("a"), entry("b"), entry("c")]},
            headers=auth,
        ).status_code
        == 200
    )

    settings.plans_enabled = True
    refused = client.post(
        "/v1/vault",
        json={"base_revision": 1, "entries": [entry("d")]},
        headers=auth,
    )
    assert refused.status_code == 402
    assert db_session.query(Account).count() == 1
