"""Vérification des jetons Google : audiences et nonce.

Ici la cryptographie est réelle : des jetons signés par une clef RSA de test,
vérifiés par le vrai `verify_id_token`. Seule la récupération des clefs
publiques de Google est remplacée, pour ne pas dépendre du réseau.
"""

from __future__ import annotations

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

import thecode_api.google as google_module
from thecode_api.config import Settings
from thecode_api.google import GoogleError, verify_id_token

WEB = "web.apps.googleusercontent.com"
IOS = "ios.apps.googleusercontent.com"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class _SigningKey:
    key = KEY.public_key()


class _FakeJwks:
    def get_signing_key_from_jwt(self, _raw):
        return _SigningKey()


@pytest.fixture(autouse=True)
def fake_jwks(monkeypatch):
    monkeypatch.setattr(google_module, "_keys", lambda: _FakeJwks())


def token(aud=WEB, **extra):
    now = int(time.time())
    claims = {
        "iss": "https://accounts.google.com",
        "aud": aud,
        "sub": "google-123",
        "email": "Julie@Exemple.fr",
        "email_verified": True,
        "iat": now,
        "exp": now + 600,
        **extra,
    }
    return jwt.encode(claims, KEY, algorithm="RS256")


def make_settings(extra=""):
    return Settings(google_client_id=WEB, google_extra_client_ids=extra)


class TestAudiences:
    def test_the_web_client_is_accepted(self):
        identity = verify_id_token(token(), make_settings())
        assert identity.sub == "google-123"
        assert identity.email == "julie@exemple.fr"

    def test_an_extra_client_is_accepted(self):
        identity = verify_id_token(token(aud=IOS), make_settings(f" {IOS} , autre-client"))
        assert identity.sub == "google-123"

    def test_an_extra_client_is_refused_when_not_configured(self):
        with pytest.raises(GoogleError):
            verify_id_token(token(aud=IOS), make_settings())

    def test_an_unknown_audience_is_refused(self):
        with pytest.raises(GoogleError):
            verify_id_token(token(aud="autre-appli"), make_settings(IOS))

    def test_extra_clients_alone_do_not_enable_google(self):
        settings = Settings(google_client_id="", google_extra_client_ids=IOS)
        assert settings.google_audiences == []
        with pytest.raises(GoogleError):
            verify_id_token(token(aud=IOS), settings)

    def test_audiences_list_the_web_client_first_without_duplicates(self):
        settings = make_settings(f"{IOS},,{WEB}")
        assert settings.google_audiences == [WEB, IOS]

    def test_a_foreign_issuer_is_refused(self):
        with pytest.raises(GoogleError):
            verify_id_token(token(iss="https://ailleurs.example"), make_settings())

    def test_an_unverified_address_is_refused(self):
        with pytest.raises(GoogleError):
            verify_id_token(token(email_verified=False), make_settings())


class TestNonce:
    def test_a_matching_nonce_is_accepted(self):
        verify_id_token(token(nonce="n-42"), make_settings(), nonce="n-42")

    def test_a_different_nonce_is_refused(self):
        with pytest.raises(GoogleError):
            verify_id_token(token(nonce="n-42"), make_settings(), nonce="n-43")

    def test_a_token_without_nonce_is_refused_when_one_is_expected(self):
        with pytest.raises(GoogleError):
            verify_id_token(token(), make_settings(), nonce="n-42")

    def test_no_nonce_expected_means_none_checked(self):
        # Android et les applications Apple n'en passent pas forcément.
        verify_id_token(token(nonce="n-42"), make_settings())


class TestRoute:
    """Le chemin complet, du corps de la requête au compte créé."""

    @pytest.fixture(autouse=True)
    def configure(self, settings):
        settings.google_client_id = WEB
        settings.google_extra_client_ids = IOS

    def test_an_app_creates_a_free_account_without_choosing_a_plan(self, client):
        response = client.post(
            "/v1/auth/google",
            json={"id_token": token(aud=IOS), "device_label": "iPhone"},
        )
        assert response.status_code == 200

        me = client.get(
            "/v1/auth/me", headers={"Authorization": f"Bearer {response.json()['access_token']}"}
        ).json()
        assert me["plan"] == "free"
        assert me["google_linked"] is True

    def test_the_extension_nonce_is_checked(self, client):
        ok = client.post("/v1/auth/google", json={"id_token": token(nonce="n-1"), "nonce": "n-1"})
        assert ok.status_code == 200

        bad = client.post("/v1/auth/google", json={"id_token": token(nonce="n-1"), "nonce": "n-2"})
        assert bad.status_code == 401
        assert bad.json()["detail"] == "Connexion Google refusée."

    def test_an_unknown_audience_is_refused(self, client):
        response = client.post("/v1/auth/google", json={"id_token": token(aud="autre-appli")})
        assert response.status_code == 401

    def test_registration_only_publishes_the_web_client(self, client):
        assert client.get("/v1/auth/registration").json()["googleClientId"] == WEB
