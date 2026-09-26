"""Réglages par défaut partagés par le compte."""

from __future__ import annotations

import base64

import pytest

from thecode_api import models
from thecode_api.routes.default_settings import MAX_SETTINGS_BYTES

PASSWORD = "mot-de-passe-de-test"


def b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def settings_body(blob=b"reglages-chiffres", nonce=b"0" * 12):
    return {"nonce": b64(nonce), "blob": b64(blob)}


def put(client, auth, body):
    return client.put("/v1/settings", headers=auth, json=body)


class TestReadWrite:
    def test_nothing_stored_yet(self, client, auth):
        """Un compte sans réglages n'a rien d'anormal : 204, pas 404."""
        response = client.get("/v1/settings", headers=auth)
        assert response.status_code == 204
        assert response.content == b""

    def test_round_trip(self, client, auth):
        body = settings_body()
        assert put(client, auth, body).status_code == 204

        response = client.get("/v1/settings", headers=auth)
        assert response.status_code == 200
        assert response.json() == body

    def test_a_write_replaces_the_previous_one(self, client, auth, db_session):
        put(client, auth, settings_body(b"ancien", b"1" * 12))
        put(client, auth, settings_body(b"nouveau", b"2" * 12))

        assert client.get("/v1/settings", headers=auth).json() == settings_body(
            b"nouveau", b"2" * 12
        )
        # Une ligne par compte, jamais d'historique.
        assert db_session.query(models.DefaultSettings).count() == 1

    def test_the_server_stores_what_it_is_given(self, client, auth, db_session):
        payload = bytes(range(256))
        put(client, auth, settings_body(payload))
        assert db_session.query(models.DefaultSettings).one().blob == payload

    def test_not_counted_in_the_entry_cap(self, client, auth, settings):
        """Ce n'est pas un mot de passe de plus : un carnet plein ne l'empêche pas."""
        settings.free_max_entries = 0
        assert put(client, auth, settings_body()).status_code == 204
        vault = client.get("/v1/vault", headers=auth).json()
        assert vault["entries"] == []


class TestValidation:
    @pytest.mark.parametrize("field", ["nonce", "blob"])
    def test_invalid_base64_is_refused(self, client, auth, field):
        body = settings_body()
        body[field] = "!!!"
        assert put(client, auth, body).status_code == 422

    def test_missing_field_is_refused(self, client, auth):
        assert put(client, auth, {"nonce": b64(b"0" * 12)}).status_code == 422

    def test_the_size_limit_is_inclusive(self, client, auth):
        assert put(client, auth, settings_body(b"x" * MAX_SETTINGS_BYTES)).status_code == 204

    def test_oversized_blob_is_refused(self, client, auth, db_session):
        response = put(client, auth, settings_body(b"x" * (MAX_SETTINGS_BYTES + 1)))
        assert response.status_code == 413
        assert db_session.query(models.DefaultSettings).count() == 0


class TestIsolation:
    @pytest.mark.parametrize("method", ["get", "put"])
    def test_requires_authentication(self, client, method):
        kwargs = {"json": settings_body()} if method == "put" else {}
        assert getattr(client, method)("/v1/settings", **kwargs).status_code == 401

    def test_an_account_never_sees_another(self, client):
        first, second = (
            client.post(
                "/v1/auth/register", json={"email": email, "password": PASSWORD}
            ).json()
            for email in ("a@example.com", "b@example.com")
        )
        put(client, {"Authorization": f"Bearer {first['access_token']}"}, settings_body())

        response = client.get(
            "/v1/settings", headers={"Authorization": f"Bearer {second['access_token']}"}
        )
        assert response.status_code == 204


class TestDeletion:
    def test_purging_the_vault_erases_the_settings(self, client, auth):
        """Les réglages voyagent avec le carnet : ils partent avec lui."""
        put(client, auth, settings_body())
        assert client.delete("/v1/vault", headers=auth).status_code == 204
        assert client.get("/v1/settings", headers=auth).status_code == 204

    def test_deleting_the_account_erases_the_settings(self, client, db_session):
        created = client.post(
            "/v1/auth/register", json={"email": "parti@example.com", "password": PASSWORD}
        ).json()
        auth = {"Authorization": f"Bearer {created['access_token']}"}
        put(client, auth, settings_body())

        response = client.request(
            "DELETE",
            "/v1/account",
            json={"password": PASSWORD, "confirm_email": "parti@example.com"},
            headers=auth,
        )

        assert response.status_code == 204
        assert db_session.query(models.DefaultSettings).count() == 0


class TestExport:
    def test_the_export_includes_the_settings(self, client, auth):
        body = settings_body()
        put(client, auth, body)

        exported = client.get("/v1/account/export", headers=auth).json()["default_settings"]

        assert exported["nonce"] == body["nonce"]
        assert exported["blob"] == body["blob"]

    def test_the_export_says_when_there_are_none(self, client, auth):
        assert client.get("/v1/account/export", headers=auth).json()["default_settings"] is None
