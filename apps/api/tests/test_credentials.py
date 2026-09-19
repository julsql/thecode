"""Google, changement d'adresse, changement et oubli de mot de passe.

Quatre façons d'entrer dans un compte ou d'en changer la serrure : c'est
exactement là qu'une erreur donne le compte de quelqu'un d'autre.

Aucun de ces changements ne touche au carnet : il est chiffré avec la clef
maîtresse, que le service ne connaît pas. Changer le mot de passe du compte ne
le rend ni lisible, ni illisible — et c'est ce que vérifie le dernier test.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

import thecode_api.routes.auth as auth_routes
from thecode_api.google import GoogleError, GoogleIdentity
from thecode_api.models import Account, EmailVerification, Session

PASSWORD = "mot-de-passe-de-test"
NEW_PASSWORD = "nouveau-mot-de-passe-de-test"


def register(client, email="julie@exemple.fr", password=PASSWORD):
    return client.post(
        "/v1/auth/register",
        json={"email": email, "password": password, "lang": "fr"},
    )


def login(client, email="julie@exemple.fr", password=PASSWORD):
    return client.post("/v1/auth/login", json={"email": email, "password": password})


def bearer(response):
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def google(monkeypatch, settings):
    """Un Google en carton : le vrai n'est jamais appelé.

    Ce qui est testé n'est pas la cryptographie de Google — c'est ce que le
    service fait d'une identité vérifiée, et ce qu'il refuse quand elle ne
    l'est pas.
    """
    settings.google_client_id = "client-de-test"
    identities: dict[str, GoogleIdentity] = {}

    def fake_verify(raw, _settings):
        if raw not in identities:
            raise GoogleError("jeton inconnu")
        return identities[raw]

    monkeypatch.setattr(auth_routes, "verify_id_token", fake_verify)
    return identities


class TestGoogle:
    def test_it_creates_an_account_on_first_sign_in(self, client, google):
        google["jeton"] = GoogleIdentity(sub="google-123", email="julie@exemple.fr")

        response = client.post("/v1/auth/google", json={"id_token": "jeton"})
        assert response.status_code == 200

        me = client.get("/v1/auth/me", headers=bearer(response)).json()
        assert me["email"] == "julie@exemple.fr"
        # Google a vérifié l'adresse : redemander une confirmation par courrier
        # ne prouverait rien de plus.
        assert me["email_verified"] is True
        assert me["google_linked"] is True
        assert me["has_password"] is False

    def test_it_reuses_the_account_on_second_sign_in(self, client, google, db_session):
        google["jeton"] = GoogleIdentity(sub="google-123", email="julie@exemple.fr")

        client.post("/v1/auth/google", json={"id_token": "jeton"})
        client.post("/v1/auth/google", json={"id_token": "jeton"})

        assert db_session.query(Account).count() == 1

    def test_it_links_an_existing_account_with_the_same_address(
        self, client, google, db_session, sent_emails
    ):
        register(client)
        google["jeton"] = GoogleIdentity(sub="google-123", email="julie@exemple.fr")

        response = client.post("/v1/auth/google", json={"id_token": "jeton"})

        # Un deuxième compte pour la même personne couperait son carnet en deux.
        assert db_session.query(Account).count() == 1
        assert client.get("/v1/auth/me", headers=bearer(response)).json()["google_linked"] is True

    def test_the_address_follows_the_google_identifier(self, client, google, db_session):
        """Le lien se fait sur `sub`, pas sur l'adresse.

        Google permet de changer d'adresse, et une adresse réattribuée à
        quelqu'un d'autre lui ouvrirait le compte.
        """
        google["jeton"] = GoogleIdentity(sub="google-123", email="julie@exemple.fr")
        client.post("/v1/auth/google", json={"id_token": "jeton"})

        google["jeton2"] = GoogleIdentity(sub="google-123", email="julie@autre.fr")
        response = client.post("/v1/auth/google", json={"id_token": "jeton2"})

        assert db_session.query(Account).count() == 1
        assert response.status_code == 200

    def test_an_unknown_token_is_refused(self, client, google):
        response = client.post("/v1/auth/google", json={"id_token": "forge"})

        assert response.status_code == 401
        # Le détail part dans les journaux : il n'aiderait pas l'utilisateur et
        # renseignerait qui cherche à forger un jeton.
        assert response.json()["detail"] == "Connexion Google refusée."

    def test_a_google_account_cannot_sign_in_with_a_password(self, client, google):
        google["jeton"] = GoogleIdentity(sub="google-123", email="julie@exemple.fr")
        client.post("/v1/auth/google", json={"id_token": "jeton"})

        response = login(client, password="au-hasard-12345")

        assert response.status_code == 401
        # Répondre « identifiants invalides » enverrait chercher une faute de
        # frappe dans un mot de passe qui n'existe pas.
        assert "Google" in response.json()["detail"]

    def test_google_respects_a_closed_registration(self, client, google, settings):
        settings.registration_mode = "closed"
        google["jeton"] = GoogleIdentity(sub="google-123", email="julie@exemple.fr")

        assert client.post("/v1/auth/google", json={"id_token": "jeton"}).status_code == 403


class TestChangePassword:
    def test_it_changes_the_password(self, client, sent_emails):
        created = register(client)

        response = client.post(
            "/v1/account/password",
            json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
            headers=bearer(created),
        )
        assert response.status_code == 200

        assert login(client, password=PASSWORD).status_code == 401
        assert login(client, password=NEW_PASSWORD).status_code == 200

    def test_the_current_password_is_required(self, client, sent_emails):
        created = register(client)

        response = client.post(
            "/v1/account/password",
            json={"current_password": "pas-le-bon-du-tout", "new_password": NEW_PASSWORD},
            headers=bearer(created),
        )

        # Un compte laissé ouvert sur un écran non verrouillé ne doit pas
        # suffire à en verrouiller le propriétaire dehors.
        assert response.status_code == 403
        assert login(client, password=PASSWORD).status_code == 200

    def test_it_disconnects_the_other_devices_but_not_this_one(self, client, sent_emails):
        created = register(client)
        phone = client.post(
            "/v1/auth/login",
            json={"email": "julie@exemple.fr", "password": PASSWORD, "device_label": "téléphone"},
        )

        client.post(
            "/v1/account/password",
            json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
            headers=bearer(created),
        )

        # L'autre appareil tombe…
        refused = client.post(
            "/v1/auth/refresh", json={"refresh_token": phone.json()["refresh_token"]}
        )
        assert refused.status_code == 401
        # …celui qui vient de changer son mot de passe, non : ce serait une
        # punition pour avoir bien fait.
        assert client.get("/v1/auth/me", headers=bearer(created)).status_code == 200

    def test_a_google_account_can_set_one(self, client, google):
        google["jeton"] = GoogleIdentity(sub="google-123", email="julie@exemple.fr")
        created = client.post("/v1/auth/google", json={"id_token": "jeton"})

        response = client.post(
            "/v1/account/password",
            json={"new_password": NEW_PASSWORD},
            headers=bearer(created),
        )
        assert response.status_code == 200

        # C'est ce qui lui ouvre les applications, qui ne savent se connecter
        # qu'avec une adresse et un mot de passe.
        assert login(client, password=NEW_PASSWORD).status_code == 200


class TestChangeEmail:
    def test_nothing_moves_before_the_link_is_followed(self, client, sent_emails):
        created = register(client)

        response = client.post(
            "/v1/account/email",
            json={"new_email": "nouvelle@exemple.fr", "password": PASSWORD, "lang": "fr"},
            headers=bearer(created),
        )
        assert response.status_code == 202

        me = client.get("/v1/auth/me", headers=bearer(created)).json()
        assert me["email"] == "julie@exemple.fr"
        assert me["pending_email"] == "nouvelle@exemple.fr"
        # L'ancienne adresse marche toujours : une demande abandonnée ne doit
        # rien laisser derrière elle.
        assert login(client).status_code == 200

    def test_the_link_goes_to_the_new_address(self, client, sent_emails):
        created = register(client)
        client.post(
            "/v1/account/email",
            json={"new_email": "nouvelle@exemple.fr", "password": PASSWORD},
            headers=bearer(created),
        )

        # C'est la nouvelle adresse qu'il s'agit de prouver : l'envoyer à
        # l'ancienne laisserait déménager le compte vers une boîte qu'on ne
        # possède pas.
        assert sent_emails[-1]["email"] == "nouvelle@exemple.fr"

    def test_following_the_link_moves_the_account(self, client, sent_emails):
        created = register(client)
        client.post(
            "/v1/account/email",
            json={"new_email": "nouvelle@exemple.fr", "password": PASSWORD},
            headers=bearer(created),
        )

        confirmed = client.post("/v1/auth/verify", json={"token": sent_emails[-1]["token"]})
        assert confirmed.status_code == 200

        me = client.get("/v1/auth/me", headers=bearer(created)).json()
        assert me["email"] == "nouvelle@exemple.fr"
        assert me["email_verified"] is True
        assert login(client, email="nouvelle@exemple.fr").status_code == 200

    def test_the_wrong_password_changes_nothing(self, client, sent_emails):
        created = register(client)

        response = client.post(
            "/v1/account/email",
            json={"new_email": "nouvelle@exemple.fr", "password": "pas-le-bon-du-tout"},
            headers=bearer(created),
        )
        assert response.status_code == 403

    def test_an_address_already_taken_is_refused(self, client, sent_emails):
        register(client, "autre@exemple.fr")
        created = register(client)

        response = client.post(
            "/v1/account/email",
            json={"new_email": "autre@exemple.fr", "password": PASSWORD},
            headers=bearer(created),
        )
        assert response.status_code == 409


class TestForgotPassword:
    def test_it_sends_a_link(self, client, sent_emails):
        register(client)
        sent_emails.clear()

        response = client.post(
            "/v1/auth/password/forgot", json={"email": "julie@exemple.fr", "lang": "fr"}
        )

        assert response.status_code == 202
        assert sent_emails[-1]["email"] == "julie@exemple.fr"

    def test_an_unknown_address_gets_the_same_answer(self, client, sent_emails):
        response = client.post("/v1/auth/password/forgot", json={"email": "personne@exemple.fr"})

        # Répondre « adresse inconnue » transformerait cette route en annuaire
        # des comptes du service.
        assert response.status_code == 202
        assert sent_emails == []

    def test_the_link_sets_a_new_password(self, client, sent_emails):
        register(client)
        client.post("/v1/auth/password/forgot", json={"email": "julie@exemple.fr"})

        response = client.post(
            "/v1/auth/password/reset",
            json={"token": sent_emails[-1]["token"], "password": NEW_PASSWORD},
        )
        assert response.status_code == 200

        assert login(client, password=NEW_PASSWORD).status_code == 200
        assert login(client, password=PASSWORD).status_code == 401

    def test_it_disconnects_every_device(self, client, sent_emails):
        created = register(client)
        client.post("/v1/auth/password/forgot", json={"email": "julie@exemple.fr"})

        client.post(
            "/v1/auth/password/reset",
            json={"token": sent_emails[-1]["token"], "password": NEW_PASSWORD},
        )

        # Une réinitialisation sert aussi à reprendre un compte dont on a perdu
        # le contrôle : laisser les sessions ouvertes laisserait la porte
        # ouverte à celui qu'on cherche à mettre dehors.
        refused = client.post(
            "/v1/auth/refresh", json={"refresh_token": created.json()["refresh_token"]}
        )
        assert refused.status_code == 401

    def test_the_link_only_works_once(self, client, sent_emails):
        register(client)
        client.post("/v1/auth/password/forgot", json={"email": "julie@exemple.fr"})
        token = sent_emails[-1]["token"]

        client.post("/v1/auth/password/reset", json={"token": token, "password": NEW_PASSWORD})
        again = client.post(
            "/v1/auth/password/reset", json={"token": token, "password": "encore-un-autre-mot-de-passe"}
        )

        assert again.status_code == 400

    def test_an_expired_link_is_refused(self, client, sent_emails, db_session):
        register(client)
        client.post("/v1/auth/password/forgot", json={"email": "julie@exemple.fr"})

        row = db_session.query(EmailVerification).filter_by(purpose="reset").one()
        row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
        db_session.commit()

        response = client.post(
            "/v1/auth/password/reset",
            json={"token": sent_emails[-1]["token"], "password": NEW_PASSWORD},
        )
        assert response.status_code == 400

    def test_a_verification_link_cannot_reset_a_password(self, client, sent_emails):
        """Un lien vaut pour ce pour quoi il a été émis, et rien d'autre.

        Sans ce contrôle, un lien de confirmation d'adresse — le plus anodin
        des trois — suffirait à reprendre le compte.
        """
        register(client)
        verification = sent_emails[-1]["token"]

        response = client.post(
            "/v1/auth/password/reset", json={"token": verification, "password": NEW_PASSWORD}
        )
        assert response.status_code == 400


def test_changing_the_password_leaves_the_vault_alone(client, sent_emails):
    """Le carnet est chiffré avec la clef maîtresse, pas avec ce mot de passe.

    C'est toute la raison d'avoir deux secrets distincts : le service peut
    changer la serrure du compte sans rien pouvoir faire du contenu.
    """
    created = register(client)
    auth = bearer(created)
    entry = {"entry_id": "e1", "nonce": "AAAAAAAAAAAAAAAA", "blob": "AAAA", "deleted": False}
    client.post("/v1/vault", json={"base_revision": 0, "entries": [entry]}, headers=auth)

    client.post(
        "/v1/account/password",
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        headers=auth,
    )

    pulled = client.get("/v1/vault", headers=auth).json()
    assert pulled["entries"][0]["blob"] == "AAAA"


def test_a_reset_keeps_the_session_table_clean(client, sent_emails, db_session):
    register(client)
    client.post("/v1/auth/password/forgot", json={"email": "julie@exemple.fr"})
    client.post(
        "/v1/auth/password/reset",
        json={"token": sent_emails[-1]["token"], "password": NEW_PASSWORD},
    )

    # Une seule session vivante : celle que la réinitialisation vient d'ouvrir.
    alive = db_session.query(Session).filter_by(revoked=False).count()
    assert alive == 1
