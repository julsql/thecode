"""Authentification."""

from __future__ import annotations

import uuid

import pytest


def register(client, email=None, password="mot-de-passe-de-test"):
    return client.post(
        "/v1/auth/register",
        json={"email": email or f"{uuid.uuid4().hex}@example.com", "password": password},
    )


class TestRegister:
    def test_creates_an_account(self, client):
        response = register(client)
        assert response.status_code == 201
        assert response.json()["access_token"]
        assert response.json()["refresh_token"]

    def test_refuses_a_duplicate_email(self, client):
        email = "deja@example.com"
        register(client, email)
        assert register(client, email).status_code == 409

    @pytest.mark.parametrize("password", ["court", "12345678901"])
    def test_refuses_a_short_password(self, client, password):
        # Ce mot de passe garde la porte du compte : trop court, il la laisse
        # ouverte.
        assert register(client, password=password).status_code == 422

    def test_refuses_an_invalid_email(self, client):
        assert register(client, email="pas-une-adresse").status_code == 422


class TestLogin:
    def test_returns_tokens(self, client):
        register(client, "moi@example.com")
        response = client.post(
            "/v1/auth/login",
            json={"email": "moi@example.com", "password": "mot-de-passe-de-test"},
        )
        assert response.status_code == 200
        assert response.json()["access_token"]

    def test_rejects_a_wrong_password(self, client):
        register(client, "moi@example.com")
        response = client.post(
            "/v1/auth/login", json={"email": "moi@example.com", "password": "pas-le-bon-du-tout"}
        )
        assert response.status_code == 401

    def test_rejects_an_unknown_account(self, client):
        response = client.post(
            "/v1/auth/login",
            json={"email": "personne@example.com", "password": "mot-de-passe-de-test"},
        )
        # Même code et même message qu'un mot de passe faux : l'existence d'un
        # compte ne doit pas se déduire de la réponse.
        assert response.status_code == 401

    def test_is_case_insensitive_on_email(self, client):
        register(client, "moi@example.com")
        response = client.post(
            "/v1/auth/login",
            json={"email": "MOI@Example.COM", "password": "mot-de-passe-de-test"},
        )
        assert response.status_code == 200


class TestRefresh:
    def test_exchanges_a_refresh_token(self, client, account):
        response = client.post(
            "/v1/auth/refresh", json={"refresh_token": account["refresh_token"]}
        )
        assert response.status_code == 200
        assert response.json()["refresh_token"] != account["refresh_token"]

    def test_the_old_token_stops_working(self, client, account):
        """Rotation : un jeton intercepté ne doit pas rester valable."""
        client.post("/v1/auth/refresh", json={"refresh_token": account["refresh_token"]})
        again = client.post(
            "/v1/auth/refresh", json={"refresh_token": account["refresh_token"]}
        )
        assert again.status_code == 401

    def test_rejects_an_unknown_token(self, client):
        assert (
            client.post("/v1/auth/refresh", json={"refresh_token": "inconnu"}).status_code == 401
        )


class TestLogout:
    def test_revokes_the_session(self, client, account):
        assert (
            client.post("/v1/auth/logout", json={"refresh_token": account["refresh_token"]}).status_code
            == 204
        )
        assert (
            client.post(
                "/v1/auth/refresh", json={"refresh_token": account["refresh_token"]}
            ).status_code
            == 401
        )


class TestMe:
    def test_describes_the_account(self, client, auth):
        response = client.get("/v1/auth/me", headers=auth)
        assert response.status_code == 200
        body = response.json()
        assert body["plan"] == "free"
        assert body["entry_count"] == 0

    def test_requires_authentication(self, client):
        assert client.get("/v1/auth/me").status_code == 401

    def test_rejects_a_forged_token(self, client):
        assert (
            client.get("/v1/auth/me", headers={"Authorization": "Bearer nimporte.quoi"}).status_code
            == 401
        )
