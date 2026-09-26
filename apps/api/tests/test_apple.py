"""Se connecter avec Apple : vérification du jeton, route, liaison, migration.

La cryptographie est réelle : des jetons signés par une clef RSA de test,
vérifiés par le vrai `verify_identity_token`. Seule la récupération des clefs
publiques d'Apple est remplacée, pour ne pas dépendre du réseau.
"""

from __future__ import annotations

import hashlib
import time
import uuid
from pathlib import Path

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.engine import make_url

import thecode_api.apple as apple_module
from thecode_api.apple import AppleError, hash_nonce, verify_identity_token
from thecode_api.config import Settings
from thecode_api.models import Account

BUNDLE = "fr.julsql.thecode"
WEB_ID = "fr.julsql.thecode.web"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PASSWORD = "mot-de-passe-de-test"


class _SigningKey:
    key = KEY.public_key()


class _FakeJwks:
    def get_signing_key_from_jwt(self, _raw):
        return _SigningKey()


@pytest.fixture(autouse=True)
def fake_jwks(monkeypatch):
    monkeypatch.setattr(apple_module, "_keys", lambda: _FakeJwks())


def token(aud=BUNDLE, key=KEY, **extra):
    now = int(time.time())
    claims = {
        "iss": "https://appleid.apple.com",
        "aud": aud,
        "sub": "001234.abcdef.1234",
        "email": "Julie@Exemple.fr",
        # Apple l'envoie souvent en chaîne.
        "email_verified": "true",
        "iat": now,
        "exp": now + 600,
        **extra,
    }
    return jwt.encode({k: v for k, v in claims.items() if v is not None}, key, algorithm="RS256")


def make_settings(ids=BUNDLE):
    return Settings(apple_client_ids=ids)


def bearer(response):
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


class TestVerify:
    def test_a_valid_token_is_accepted(self):
        identity = verify_identity_token(token(), make_settings())
        assert identity.sub == "001234.abcdef.1234"
        assert identity.email == "julie@exemple.fr"

    def test_a_boolean_email_verified_is_accepted(self):
        identity = verify_identity_token(token(email_verified=True), make_settings())
        assert identity.email == "julie@exemple.fr"

    def test_an_unverified_address_is_dropped(self):
        identity = verify_identity_token(token(email_verified="false"), make_settings())
        assert identity.email == ""

    def test_one_of_several_audiences_is_accepted(self):
        settings = make_settings(f" autre.appli , {BUNDLE},{BUNDLE}")
        assert settings.apple_audiences == ["autre.appli", BUNDLE]
        verify_identity_token(token(), settings)

    def test_the_web_services_id_is_accepted(self):
        settings = Settings(apple_client_ids=BUNDLE, apple_web_client_id=WEB_ID)
        assert settings.apple_audiences == [BUNDLE, WEB_ID]
        verify_identity_token(token(aud=WEB_ID), settings)

    def test_the_web_services_id_alone_enables_apple(self):
        settings = Settings(apple_web_client_id=WEB_ID)
        assert settings.apple_enabled is True
        verify_identity_token(token(aud=WEB_ID), settings)
        with pytest.raises(AppleError):
            verify_identity_token(token(), settings)

    def test_an_unknown_audience_is_refused(self):
        with pytest.raises(AppleError):
            verify_identity_token(token(aud="autre.appli"), make_settings())

    def test_apple_is_disabled_without_client_ids(self):
        settings = make_settings(" , ")
        assert settings.apple_enabled is False
        with pytest.raises(AppleError):
            verify_identity_token(token(), settings)

    def test_a_foreign_issuer_is_refused(self):
        with pytest.raises(AppleError):
            verify_identity_token(token(iss="https://accounts.google.com"), make_settings())

    def test_an_expired_token_is_refused(self):
        with pytest.raises(AppleError):
            verify_identity_token(token(exp=int(time.time()) - 60), make_settings())

    def test_a_token_without_sub_is_refused(self):
        with pytest.raises(AppleError):
            verify_identity_token(token(sub=None), make_settings())

    def test_a_forged_signature_is_refused(self):
        with pytest.raises(AppleError):
            verify_identity_token(token(key=OTHER_KEY), make_settings())


class TestNonce:
    """Le client envoie le nonce brut ; le jeton porte son SHA-256 hexadécimal."""

    def test_the_hash_is_sha256_hex(self):
        assert hash_nonce("abc") == hashlib.sha256(b"abc").hexdigest()

    def test_the_raw_nonce_matches_the_hashed_claim(self):
        verify_identity_token(token(nonce=hash_nonce("n-42")), make_settings(), nonce="n-42")

    def test_sending_the_hash_itself_is_refused(self):
        hashed = hash_nonce("n-42")
        with pytest.raises(AppleError):
            verify_identity_token(token(nonce=hashed), make_settings(), nonce=hashed)

    def test_a_different_nonce_is_refused(self):
        with pytest.raises(AppleError):
            verify_identity_token(token(nonce=hash_nonce("n-42")), make_settings(), nonce="n-43")

    def test_a_token_without_nonce_is_refused_when_one_is_expected(self):
        with pytest.raises(AppleError):
            verify_identity_token(token(), make_settings(), nonce="n-42")

    def test_no_nonce_expected_means_none_checked(self):
        verify_identity_token(token(nonce=hash_nonce("n-42")), make_settings())


class TestRoute:
    @pytest.fixture(autouse=True)
    def configure(self, settings):
        settings.apple_client_ids = BUNDLE

    def sign_in(self, http, raw=None, **body):
        return http.post("/v1/auth/apple", json={"identity_token": raw or token(), **body})

    def test_it_creates_a_free_account(self, client, db_session):
        response = self.sign_in(client, device_label="iPhone de Julie")
        assert response.status_code == 200, response.text

        me = client.get("/v1/auth/me", headers=bearer(response)).json()
        assert me["plan"] == "free"
        assert me["apple_linked"] is True
        assert me["google_linked"] is False
        assert me["has_password"] is False
        assert me["email_verified"] is True
        account = db_session.scalars(select_account("julie@exemple.fr")).one()
        assert account.apple_sub == "001234.abcdef.1234"

    def test_a_private_relay_address_makes_a_new_account(self, client):
        relay = "x7y2@privaterelay.appleid.com"
        response = self.sign_in(client, token(email=relay))
        assert response.status_code == 200
        assert client.get("/v1/auth/me", headers=bearer(response)).json()["email"] == relay

    def test_it_reuses_the_account_by_sub(self, client, db_session):
        self.sign_in(client)
        # Apple ne renvoie pas toujours l'adresse : le `sub` suffit.
        again = self.sign_in(client, token(email=None, email_verified=None))
        assert again.status_code == 200
        assert db_session.query(Account).count() == 1

    def test_without_address_no_account_is_created(self, client, db_session):
        response = self.sign_in(client, token(email=None, email_verified=None))
        assert response.status_code == 400
        assert db_session.query(Account).count() == 0

    def test_it_links_an_existing_account_by_verified_address(self, client, db_session):
        client.post("/v1/auth/register", json={"email": "julie@exemple.fr", "password": PASSWORD})

        response = self.sign_in(client)

        assert response.status_code == 200
        assert db_session.query(Account).count() == 1
        me = client.get("/v1/auth/me", headers=bearer(response)).json()
        assert me["apple_linked"] is True
        assert me["email_verified"] is True

    def test_an_unverified_address_does_not_link(self, client, db_session):
        client.post("/v1/auth/register", json={"email": "julie@exemple.fr", "password": PASSWORD})

        response = self.sign_in(client, token(email_verified="false"))

        assert response.status_code == 400
        account = db_session.scalars(select_account("julie@exemple.fr")).one()
        assert account.apple_sub == ""

    def test_another_apple_id_cannot_take_a_linked_account(self, client):
        self.sign_in(client)
        response = self.sign_in(client, token(sub="autre.sub"))
        assert response.status_code == 409

    def test_the_raw_nonce_is_checked(self, client):
        raw = token(nonce=hash_nonce("n-1"))
        assert self.sign_in(client, raw, nonce="n-1").status_code == 200

        bad = self.sign_in(client, raw, nonce="n-2")
        assert bad.status_code == 401
        assert bad.json()["detail"] == "Connexion Apple refusée."

    def test_a_wrong_audience_is_refused(self, client):
        assert self.sign_in(client, token(aud="autre.appli")).status_code == 401

    def test_a_closed_registration_is_respected(self, client, settings):
        settings.registration_mode = "closed"
        assert self.sign_in(client).status_code == 403

    def test_an_invite_code_is_required_in_invite_mode(self, client, settings):
        settings.registration_mode = "invite"
        settings.invite_code = "code-secret"
        assert self.sign_in(client).status_code == 403
        assert self.sign_in(client, invite_code="code-secret").status_code == 200

    def test_the_device_cap_applies(self, client, settings):
        settings.free_max_devices = 1
        assert self.sign_in(client).status_code == 200
        assert self.sign_in(client).status_code == 402
        # Le site n'est jamais refusé.
        assert self.sign_in(client, client="web").status_code == 200

    def test_password_login_names_apple(self, client):
        self.sign_in(client)
        response = client.post(
            "/v1/auth/login", json={"email": "julie@exemple.fr", "password": PASSWORD}
        )
        assert response.status_code == 401
        assert "Apple" in response.json()["detail"]

    def test_registration_says_whether_apple_is_enabled(self, client, settings):
        state = client.get("/v1/auth/registration").json()
        assert state["appleEnabled"] is True
        # Le bundle id des applications n'est jamais publié.
        assert state["appleWebClientId"] == ""
        settings.apple_client_ids = ""
        assert client.get("/v1/auth/registration").json()["appleEnabled"] is False

    def test_registration_publishes_the_web_services_id(self, client, settings):
        settings.apple_web_client_id = WEB_ID
        assert client.get("/v1/auth/registration").json()["appleWebClientId"] == WEB_ID

    def test_the_site_signs_in_with_its_services_id(self, client, settings):
        settings.apple_web_client_id = WEB_ID
        settings.free_max_devices = 0
        response = self.sign_in(client, token(aud=WEB_ID), client="web")
        assert response.status_code == 200

    def test_the_export_says_apple_is_linked(self, client):
        created = self.sign_in(client)
        export = client.get("/v1/account/export", headers=bearer(created)).json()
        assert export["account"]["apple_linked"] is True


class TestUnlink:
    @pytest.fixture(autouse=True)
    def configure(self, settings):
        settings.apple_client_ids = BUNDLE

    def unlink(self, client, created, provider="apple"):
        return client.request("DELETE", f"/v1/account/{provider}", headers=bearer(created))

    def test_without_password_nor_google_it_is_refused(self, client):
        created = client.post("/v1/auth/apple", json={"identity_token": token()})
        response = self.unlink(client, created)
        assert response.status_code == 409
        assert "mot de passe" in response.json()["detail"]
        assert client.get("/v1/auth/me", headers=bearer(created)).json()["apple_linked"] is True

    def test_with_a_password_it_unlinks(self, client):
        created = client.post("/v1/auth/apple", json={"identity_token": token()})
        client.post("/v1/account/password", json={"new_password": PASSWORD}, headers=bearer(created))

        assert self.unlink(client, created).status_code == 204
        assert client.get("/v1/auth/me", headers=bearer(created)).json()["apple_linked"] is False

    def test_with_google_linked_it_unlinks(self, client, db_session):
        created = client.post("/v1/auth/apple", json={"identity_token": token()})
        account = db_session.scalars(select_account("julie@exemple.fr")).one()
        account.google_sub = "google-123"
        db_session.commit()

        assert self.unlink(client, created).status_code == 204

    def test_google_can_be_unlinked_when_apple_remains(self, client, db_session):
        created = client.post("/v1/auth/apple", json={"identity_token": token()})
        account = db_session.scalars(select_account("julie@exemple.fr")).one()
        account.google_sub = "google-123"
        db_session.commit()

        assert self.unlink(client, created, "google").status_code == 204
        me = client.get("/v1/auth/me", headers=bearer(created)).json()
        assert me["google_linked"] is False
        assert me["apple_linked"] is True

    def test_nothing_to_unlink(self, client, auth):
        response = client.request("DELETE", "/v1/account/apple", headers=auth)
        assert response.status_code == 409


def select_account(email):
    return select(Account).where(Account.email == email)


class TestMigration:
    """La migration s'applique et se défait sur une base neuve."""

    @pytest.fixture
    def fresh_url(self, postgres_url, monkeypatch):
        name = f"migr_{uuid.uuid4().hex[:8]}"
        admin = create_engine(postgres_url, isolation_level="AUTOCOMMIT")
        with admin.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{name}"'))
        url = make_url(postgres_url).set(database=name)
        rendered = url.render_as_string(hide_password=False)
        monkeypatch.setenv("THECODE_DATABASE_URL", rendered)
        # `migrations/env.py` lit la vraie configuration : elle doit passer
        # ses propres contrôles de démarrage.
        monkeypatch.setenv("THECODE_REGISTRATION_MODE", "open")
        monkeypatch.setenv("THECODE_ENVIRONMENT", "test")
        yield rendered
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()

    def test_upgrade_and_downgrade(self, fresh_url):
        from alembic import command
        from alembic.config import Config

        from thecode_api.config import get_settings

        root = Path(__file__).resolve().parent.parent
        # Sans fichier : `env.py` appliquerait sinon la configuration des
        # journaux d'`alembic.ini`, qui coupe ceux déjà créés par les autres
        # tests.
        config = Config()
        config.set_main_option("script_location", str(root / "migrations"))

        get_settings.cache_clear()
        try:
            command.upgrade(config, "head")
            engine = create_engine(fresh_url)
            columns = {c["name"] for c in inspect(engine).get_columns("accounts")}
            assert "apple_sub" in columns
            indexes = {i["name"]: i for i in inspect(engine).get_indexes("accounts")}
            assert indexes["ix_accounts_apple_sub"]["unique"]

            with engine.begin() as connection:
                # Plusieurs comptes non liés : la chaîne vide ne compte pas.
                for n in range(2):
                    connection.execute(
                        text(
                            "INSERT INTO accounts (id, email, password_hash, created_at, "
                            "revision, plan, subscription_status, plan_source, "
                            "stripe_customer_id, stripe_subscription_id, pending_coupon) "
                            "VALUES (gen_random_uuid(), :email, '', now(), 0, 'free', "
                            "'active', 'none', '', '', '')"
                        ),
                        {"email": f"u{n}@exemple.fr"},
                    )

            command.downgrade(config, "-1")
            columns = {c["name"] for c in inspect(engine).get_columns("accounts")}
            assert "apple_sub" not in columns
            engine.dispose()
        finally:
            get_settings.cache_clear()
