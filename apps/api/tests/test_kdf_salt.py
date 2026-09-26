"""Sel de dérivation par compte (shared/spec/vault-sync.md, « Sel du compte »).

Le sel n'est pas un secret : ce qui compte, c'est que chaque compte ait le sien,
dès sa création et quel que soit le chemin, qu'il ne change jamais, et que le
client le reçoive partout où il en a besoin.
"""

from __future__ import annotations

import base64
import uuid

from sqlalchemy import create_engine, inspect, text

from thecode_api.google import GoogleIdentity
from thecode_api.models import Account

PASSWORD = "mot-de-passe-de-test"


def decode(value: str) -> bytes:
    assert "=" not in value and "+" not in value and "/" not in value
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def register(client, email=None):
    response = client.post(
        "/v1/auth/register",
        json={"email": email or f"{uuid.uuid4().hex}@example.com", "password": PASSWORD},
    )
    assert response.status_code == 201, response.text
    return response.json()


def bearer(body):
    return {"Authorization": f"Bearer {body['access_token']}"}


class TestExposure:
    def test_register_returns_a_16_byte_salt(self, client):
        body = register(client)
        assert len(body["kdf_salt"]) == 22
        assert len(decode(body["kdf_salt"])) == 16

    def test_every_account_gets_its_own(self, client):
        salts = {register(client)["kdf_salt"] for _ in range(5)}
        assert len(salts) == 5

    def test_login_refresh_and_me_give_the_same_salt(self, client):
        created = register(client, "moi@example.com")
        salt = created["kdf_salt"]

        login = client.post(
            "/v1/auth/login", json={"email": "moi@example.com", "password": PASSWORD}
        ).json()
        refreshed = client.post(
            "/v1/auth/refresh", json={"refresh_token": login["refresh_token"]}
        ).json()
        me = client.get("/v1/auth/me", headers=bearer(refreshed)).json()

        assert login["kdf_salt"] == refreshed["kdf_salt"] == me["kdf_salt"] == salt

    def test_changing_the_password_keeps_the_salt(self, client):
        created = register(client)
        response = client.post(
            "/v1/account/password",
            json={"current_password": PASSWORD, "new_password": "un-autre-mot-de-passe"},
            headers=bearer(created),
        )
        assert response.status_code in (200, 204), response.text
        assert client.get("/v1/auth/me", headers=bearer(created)).json()["kdf_salt"] == (
            created["kdf_salt"]
        )

    def test_export_includes_the_salt(self, client):
        created = register(client)
        export = client.get("/v1/account/export", headers=bearer(created)).json()
        assert export["account"]["kdf_salt"] == created["kdf_salt"]

    def test_stored_as_16_raw_bytes(self, client, db_session):
        created = register(client, "brut@example.com")
        account = db_session.query(Account).filter_by(email="brut@example.com").one()
        assert account.kdf_salt == decode(created["kdf_salt"])


class TestProviders:
    def test_a_google_account_gets_a_salt(self, client, monkeypatch, settings):
        import thecode_api.routes.auth as auth_routes

        settings.google_client_id = "client-de-test"
        monkeypatch.setattr(
            auth_routes,
            "verify_id_token",
            lambda raw, _settings, _nonce="": GoogleIdentity(sub="g-1", email="g@exemple.fr"),
        )

        body = client.post("/v1/auth/google", json={"id_token": "jeton"}).json()

        assert len(decode(body["kdf_salt"])) == 16
        again = client.post("/v1/auth/google", json={"id_token": "jeton"}).json()
        assert again["kdf_salt"] == body["kdf_salt"]

    def test_an_apple_account_gets_a_salt(self, client, monkeypatch, settings):
        import thecode_api.routes.auth as auth_routes
        from thecode_api.apple import AppleIdentity

        settings.apple_client_ids = "fr.julsql.thecode"
        monkeypatch.setattr(
            auth_routes,
            "verify_identity_token",
            lambda *args, **kwargs: AppleIdentity(
                sub="a-1", email="a@exemple.fr", audience="fr.julsql.thecode"
            ),
        )

        body = client.post("/v1/auth/apple", json={"identity_token": "jeton"}).json()

        assert len(decode(body["kdf_salt"])) == 16


class TestMigration:
    def test_existing_accounts_get_distinct_salts_and_v1_blobs_go(
        self, fresh_url, alembic_config
    ):
        from alembic import command

        from thecode_api.config import get_settings

        get_settings.cache_clear()
        try:
            command.upgrade(alembic_config, "f6c1d2e8b935")
            engine = create_engine(fresh_url)
            with engine.begin() as connection:
                ids = []
                for n in range(3):
                    ids.append(
                        connection.execute(
                            text(
                                "INSERT INTO accounts (id, email, password_hash, created_at, "
                                "revision, plan, subscription_status, plan_source, "
                                "stripe_customer_id, stripe_subscription_id, pending_coupon) "
                                "VALUES (gen_random_uuid(), :email, '', now(), 1, 'free', "
                                "'active', 'none', '', '', '') RETURNING id"
                            ),
                            {"email": f"u{n}@exemple.fr"},
                        ).scalar_one()
                    )
                connection.execute(
                    text(
                        "INSERT INTO vault_entries (id, account_id, entry_id, nonce, blob, "
                        "revision, updated_at, deleted) VALUES (gen_random_uuid(), :account, "
                        "'e1', '\\x00', '\\x00', 1, now(), false)"
                    ),
                    {"account": ids[0]},
                )
                connection.execute(
                    text(
                        "INSERT INTO default_settings (account_id, nonce, blob, updated_at) "
                        "VALUES (:account, '\\x00', '\\x00', now())"
                    ),
                    {"account": ids[0]},
                )

            command.upgrade(alembic_config, "head")

            column = next(
                c for c in inspect(engine).get_columns("accounts") if c["name"] == "kdf_salt"
            )
            assert column["nullable"] is False
            with engine.connect() as connection:
                salts = connection.execute(text("SELECT kdf_salt FROM accounts")).scalars().all()
                assert len(salts) == 3
                assert all(len(bytes(salt)) == 16 for salt in salts)
                assert len({bytes(salt) for salt in salts}) == 3
                # Les blobs v1 ne se liraient plus : ils sont effacés.
                assert connection.execute(text("SELECT count(*) FROM vault_entries")).scalar() == 0
                assert (
                    connection.execute(text("SELECT count(*) FROM default_settings")).scalar()
                    == 0
                )

            command.downgrade(alembic_config, "-1")
            columns = {c["name"] for c in inspect(engine).get_columns("accounts")}
            assert "kdf_salt" not in columns
            engine.dispose()
        finally:
            get_settings.cache_clear()
