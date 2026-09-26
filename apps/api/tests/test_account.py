"""Vérification d'adresse, appareils connectés et codes.

Ces trois sujets tiennent dans le même fichier parce qu'ils décrivent la même
chose : ce qu'un compte a le droit de faire, et comment il le prouve.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from thecode_api import models
from thecode_api.models import Account, Code, EmailVerification

PASSWORD = "mot-de-passe-de-test"


def register(client, email="nouveau@exemple.fr", code="", lang="fr"):
    return client.post(
        "/v1/auth/register",
        json={"email": email, "password": PASSWORD, "invite_code": code, "lang": lang},
    )


def login(client, email="nouveau@exemple.fr", label="", client_kind="app"):
    return client.post(
        "/v1/auth/login",
        json={
            "email": email,
            "password": PASSWORD,
            "device_label": label,
            "client": client_kind,
        },
    )


def bearer(response):
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


class TestEmailVerification:
    def test_a_new_account_is_not_verified(self, client, sent_emails):
        response = register(client)
        assert response.status_code == 201

        me = client.get("/v1/auth/me", headers=bearer(response)).json()
        assert me["email_verified"] is False

    def test_the_link_confirms_the_address(self, client, sent_emails):
        created = register(client)
        assert len(sent_emails) == 1
        assert sent_emails[0]["lang"] == "fr"

        confirmed = client.post("/v1/auth/verify", json={"token": sent_emails[0]["token"]})
        assert confirmed.status_code == 200

        me = client.get("/v1/auth/me", headers=bearer(created)).json()
        assert me["email_verified"] is True

    def test_the_link_only_works_once(self, client, sent_emails):
        register(client)
        token = sent_emails[0]["token"]
        assert client.post("/v1/auth/verify", json={"token": token}).status_code == 200
        # Rejouable, un lien intercepté resterait utilisable indéfiniment.
        assert client.post("/v1/auth/verify", json={"token": token}).status_code == 400

    def test_an_unknown_token_is_refused(self, client):
        assert client.post("/v1/auth/verify", json={"token": "n-importe-quoi"}).status_code == 400

    def test_an_expired_link_is_refused(self, client, sent_emails, db_session):
        register(client)
        row = db_session.query(EmailVerification).one()
        row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
        db_session.commit()

        assert (
            client.post("/v1/auth/verify", json={"token": sent_emails[0]["token"]}).status_code
            == 400
        )

    def test_resending_invalidates_the_previous_link(self, client, sent_emails):
        created = register(client)
        first = sent_emails[0]["token"]

        again = client.post("/v1/auth/verify/resend", json={"lang": "fr"}, headers=bearer(created))
        assert again.status_code == 202
        second = sent_emails[-1]["token"]
        assert second != first

        # Deux liens vivants pour une même adresse, c'est une porte de plus
        # sans aucun bénéfice.
        assert client.post("/v1/auth/verify", json={"token": first}).status_code == 400
        assert client.post("/v1/auth/verify", json={"token": second}).status_code == 200


class TestDevices:
    def test_the_account_lists_its_devices(self, client, sent_emails):
        created = register(client)
        login(client, label="téléphone")

        devices = client.get("/v1/account/devices", headers=bearer(created)).json()
        assert len(devices) == 2
        assert "téléphone" in [d["label"] for d in devices]

    def test_a_device_can_be_disconnected(self, client, sent_emails):
        created = register(client)
        second = login(client, label="téléphone")

        devices = client.get("/v1/account/devices", headers=bearer(created)).json()
        phone = next(d for d in devices if d["label"] == "téléphone")
        assert (
            client.delete(f"/v1/account/devices/{phone['id']}", headers=bearer(created)).status_code
            == 204
        )

        # Le jeton de renouvellement de l'appareil déconnecté ne vaut plus rien.
        refused = client.post(
            "/v1/auth/refresh", json={"refresh_token": second.json()["refresh_token"]}
        )
        assert refused.status_code == 401

    def test_another_account_cannot_disconnect_it(self, client, sent_emails):
        mine = register(client, "moi@exemple.fr")
        other = register(client, "autre@exemple.fr")

        device = client.get("/v1/account/devices", headers=bearer(mine)).json()[0]
        assert (
            client.delete(f"/v1/account/devices/{device['id']}", headers=bearer(other)).status_code
            == 404
        )

    def test_the_free_plan_caps_connected_devices(self, client, settings, sent_emails):
        settings.free_max_devices = 2
        register(client)
        login(client, label="téléphone")

        refused = login(client, label="tablette")
        assert refused.status_code == 402
        assert "appareils" in refused.json()["detail"]

    def test_disconnecting_frees_a_slot(self, client, settings, sent_emails):
        settings.free_max_devices = 2
        created = register(client)
        login(client, label="téléphone")
        assert login(client, label="tablette").status_code == 402

        device = client.get("/v1/account/devices", headers=bearer(created)).json()[0]
        client.delete(f"/v1/account/devices/{device['id']}", headers=bearer(created))

        assert login(client, label="tablette").status_code == 200

    def test_a_paid_account_gets_the_larger_cap(self, client, settings, db_session, sent_emails):
        settings.free_max_devices = 1
        settings.pro_max_devices = 5
        register(client)

        account = db_session.query(Account).one()
        account.plan = "pro"
        account.subscription_status = "active"
        db_session.commit()

        assert login(client, label="téléphone").status_code == 200

    def test_the_paid_cap_is_refused_without_asking_to_pay(
        self, client, settings, db_session, sent_emails
    ):
        settings.pro_max_devices = 2
        register(client)

        account = db_session.query(Account).one()
        account.plan = "pro"
        account.subscription_status = "active"
        db_session.commit()
        login(client, label="téléphone")

        refused = login(client, label="tablette")
        assert refused.status_code == 403
        assert "Offre" not in refused.json()["detail"]


class TestWebSessions:
    """Le site gère les appareils : le plafond ne doit jamais lui fermer la porte."""

    def test_a_web_session_is_not_counted(self, client, settings, sent_emails):
        settings.free_max_devices = 2
        created = register(client)
        login(client, label="site web", client_kind="web")

        me = client.get("/v1/auth/me", headers=bearer(created)).json()
        assert me["device_count"] == 1
        assert login(client, label="téléphone").status_code == 200

    def test_the_website_signs_in_at_the_cap(self, client, settings, sent_emails):
        settings.free_max_devices = 2
        register(client)
        login(client, label="téléphone")
        assert login(client, label="tablette").status_code == 402

        allowed = login(client, label="site web", client_kind="web")
        assert allowed.status_code == 200
        me = client.get("/v1/auth/me", headers=bearer(allowed)).json()
        assert me["device_count"] == 2

    def test_the_paid_cap_does_not_stop_the_website(
        self, client, settings, db_session, sent_emails
    ):
        settings.pro_max_devices = 1
        register(client)
        account = db_session.query(Account).one()
        account.plan = "pro"
        account.subscription_status = "active"
        db_session.commit()

        assert login(client, label="tablette").status_code == 403
        assert login(client, label="site web", client_kind="web").status_code == 200

    def test_a_refreshed_web_session_stays_web(self, client, settings, sent_emails):
        settings.free_max_devices = 1
        register(client)
        web = login(client, label="site web", client_kind="web").json()

        renewed = client.post("/v1/auth/refresh", json={"refresh_token": web["refresh_token"]})
        assert renewed.status_code == 200
        devices = client.get(
            "/v1/account/devices",
            headers={"Authorization": f"Bearer {renewed.json()['access_token']}"},
        ).json()
        assert [d["client"] for d in devices if d["label"] == "site web"] == ["web"]

    def test_too_many_web_sessions_sign_out_the_oldest(self, client, settings, sent_emails):
        settings.web_max_sessions = 2
        created = register(client)
        first = login(client, label="site web", client_kind="web").json()
        login(client, label="site web", client_kind="web")
        latest = login(client, label="site web", client_kind="web")
        assert latest.status_code == 200

        devices = client.get("/v1/account/devices", headers=bearer(latest)).json()
        assert sum(d["client"] == "web" for d in devices) == 2
        # L'inscription n'a pas dit « web » : c'est un appareil, jamais écarté.
        assert sum(d["client"] == "app" for d in devices) == 1
        refused = client.post("/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
        assert refused.status_code == 401
        assert client.get("/v1/auth/me", headers=bearer(created)).status_code == 200

    def test_a_web_session_can_be_disconnected(self, client, sent_emails):
        created = register(client)
        login(client, label="site web", client_kind="web")

        devices = client.get("/v1/account/devices", headers=bearer(created)).json()
        web = next(d for d in devices if d["client"] == "web")
        response = client.delete(f"/v1/account/devices/{web['id']}", headers=bearer(created))
        assert response.status_code == 204

    def test_the_reset_link_opens_a_web_session(self, client, settings, sent_emails):
        settings.free_max_devices = 1
        register(client, email="oubli@exemple.fr")
        login(client, email="oubli@exemple.fr", label="téléphone")
        client.post("/v1/auth/password/forgot", json={"email": "oubli@exemple.fr"})
        reset = client.post(
            "/v1/auth/password/reset",
            json={"token": sent_emails[-1]["token"], "password": PASSWORD + "-bis"},
        )
        assert reset.status_code == 200

        me = client.get("/v1/auth/me", headers=bearer(reset)).json()
        assert me["device_count"] == 0

    def test_an_unknown_client_is_rejected(self, client, sent_emails):
        register(client)
        assert login(client, client_kind="admin").status_code == 422


@pytest.fixture
def lifetime_code(db_session):
    code = Code(code="AVIE", kind="lifetime", note="ami de la première heure")
    db_session.add(code)
    db_session.commit()
    return code


@pytest.fixture
def referral_code(db_session):
    code = Code(code="PARRAIN", kind="referral", stripe_coupon_id="coupon_test")
    db_session.add(code)
    db_session.commit()
    return code


class TestCodes:
    def test_a_lifetime_code_gives_the_full_plan(
        self, client, lifetime_code, db_session, sent_emails
    ):
        created = register(client, code="avie")  # la casse ne doit pas compter
        me = client.get("/v1/auth/me", headers=bearer(created)).json()

        assert me["plan"] == "pro"
        assert me["subscription_status"] == "lifetime"
        assert me["plan_source"] == "lifetime"
        db_session.expire_all()
        assert db_session.query(Code).one().used_count == 1

    def test_a_referral_code_keeps_the_discount_for_later(
        self, client, referral_code, sent_emails
    ):
        created = register(client, code="PARRAIN")
        me = client.get("/v1/auth/me", headers=bearer(created)).json()

        # La remise s'applique à l'abonnement, qui vient plus tard : le compte
        # reste gratuit en attendant.
        assert me["plan"] == "free"
        assert me["has_pending_coupon"] is True

    def test_a_code_can_be_used_after_the_fact(self, client, lifetime_code, sent_emails):
        created = register(client)
        response = client.post("/v1/account/code", json={"code": "AVIE"}, headers=bearer(created))

        assert response.status_code == 200
        assert response.json()["kind"] == "lifetime"
        assert client.get("/v1/auth/me", headers=bearer(created)).json()["plan"] == "pro"

    def test_the_same_code_cannot_be_replayed(self, client, lifetime_code, sent_emails):
        created = register(client)
        client.post("/v1/account/code", json={"code": "AVIE"}, headers=bearer(created))

        again = client.post("/v1/account/code", json={"code": "AVIE"}, headers=bearer(created))
        assert again.status_code == 409

    def test_an_unknown_code_is_refused(self, client, sent_emails):
        created = register(client)
        response = client.post(
            "/v1/account/code", json={"code": "INVENTE"}, headers=bearer(created)
        )
        assert response.status_code == 404

    def test_an_exhausted_code_is_refused(self, client, db_session, sent_emails):
        db_session.add(Code(code="UNEFOIS", kind="lifetime", max_uses=1, used_count=1))
        db_session.commit()

        created = register(client)
        response = client.post(
            "/v1/account/code", json={"code": "UNEFOIS"}, headers=bearer(created)
        )
        assert response.status_code == 404

    def test_an_expired_code_is_refused(self, client, db_session, sent_emails):
        db_session.add(
            Code(
                code="PERIME",
                kind="lifetime",
                expires_at=datetime.now(UTC) - timedelta(days=1),
            )
        )
        db_session.commit()

        created = register(client)
        response = client.post("/v1/account/code", json={"code": "PERIME"}, headers=bearer(created))
        assert response.status_code == 404

    def test_a_stored_code_opens_a_closed_registration(
        self, client, settings, lifetime_code, sent_emails
    ):
        """Un code en base vaut invitation : sinon le code à vie d'un nouveau
        venu ne servirait qu'à ceux qui ont déjà un compte."""
        settings.registration_mode = "invite"
        settings.invite_code = "le-code-de-la-config"

        assert register(client, "avec-code@exemple.fr", code="AVIE").status_code == 201
        assert register(client, "sans-code@exemple.fr").status_code == 403


class TestExport:
    def test_it_gives_back_everything_the_service_holds(self, client, sent_emails):
        created = register(client)
        auth = bearer(created)
        entry = {"entry_id": "e1", "nonce": "AAAAAAAAAAAAAAAA", "blob": "AAAA", "deleted": False}
        client.post("/v1/vault", json={"base_revision": 0, "entries": [entry]}, headers=auth)

        body = client.get("/v1/account/export", headers=auth).json()

        assert body["account"]["email"] == "nouveau@exemple.fr"
        assert len(body["devices"]) == 1
        # Le carnet en fait partie : il appartient à l'utilisateur, même si le
        # service ne peut pas le lire.
        assert body["vault"][0]["entry_id"] == "e1"
        assert body["vault"][0]["blob"] == "AAAA"
        assert "chiffrées" in body["note"]

    def test_it_never_returns_a_secret(self, client, sent_emails):
        created = register(client)
        raw = client.get("/v1/account/export", headers=bearer(created)).text

        # Ni le haché du mot de passe, ni les jetons : un export est un fichier
        # qui traîne ensuite dans un dossier de téléchargements.
        assert "argon2" not in raw
        assert "password_hash" not in raw
        assert "token" not in raw
        assert created.json()["refresh_token"] not in raw


class TestDeleteAccount:
    def delete(self, client, created, email="nouveau@exemple.fr", password=PASSWORD):
        return client.request(
            "DELETE",
            "/v1/account",
            json={"password": password, "confirm_email": email},
            headers=bearer(created),
        )

    def test_it_erases_the_account_and_its_vault(self, client, db_session, sent_emails):
        created = register(client)
        auth = bearer(created)
        entry = {"entry_id": "e1", "nonce": "AAAAAAAAAAAAAAAA", "blob": "AAAA", "deleted": False}
        client.post("/v1/vault", json={"base_revision": 0, "entries": [entry]}, headers=auth)

        assert self.delete(client, created).status_code == 204

        # Vraiment effacé, pas marqué comme tel : garder « au cas où » des
        # carnets de gens partis est précisément ce qu'on reproche aux autres.
        assert db_session.query(Account).count() == 0
        assert db_session.query(models.VaultEntry).count() == 0
        assert db_session.query(models.Session).count() == 0
        assert db_session.query(EmailVerification).count() == 0

    def test_the_wrong_address_stops_it(self, client, db_session, sent_emails):
        created = register(client)

        response = self.delete(client, created, email="autre@exemple.fr")

        assert response.status_code == 400
        assert db_session.query(Account).count() == 1

    def test_the_wrong_password_stops_it(self, client, db_session, sent_emails):
        created = register(client)

        response = self.delete(client, created, password="pas-le-bon-du-tout")

        # Un écran resté ouvert ne doit pas suffire à effacer un carnet.
        assert response.status_code == 403
        assert db_session.query(Account).count() == 1

    def test_another_account_is_untouched(self, client, db_session, sent_emails):
        register(client, "autre@exemple.fr")
        created = register(client)

        self.delete(client, created)

        assert db_session.query(Account).one().email == "autre@exemple.fr"

    def test_the_session_stops_working(self, client, sent_emails):
        created = register(client)
        self.delete(client, created)

        assert client.get("/v1/auth/me", headers=bearer(created)).status_code == 401

    def test_the_address_becomes_free_again(self, client, sent_emails):
        created = register(client)
        self.delete(client, created)

        # Une place libérée est une place rendue : c'est aussi ce que dit le
        # quota d'inscriptions.
        assert register(client).status_code == 201
