"""Synchronisation du carnet."""

from __future__ import annotations

import base64

import pytest


def b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def entry(entry_id="e1", blob=b"chiffre", nonce=b"0" * 12, deleted=False):
    return {"entry_id": entry_id, "nonce": b64(nonce), "blob": b64(blob), "deleted": deleted}


def push(client, auth, entries, base_revision=0):
    return client.post(
        "/v1/vault", headers=auth, json={"base_revision": base_revision, "entries": entries}
    )


class TestPushPull:
    def test_round_trip(self, client, auth):
        assert push(client, auth, [entry()]).status_code == 200
        body = client.get("/v1/vault", headers=auth).json()
        assert len(body["entries"]) == 1
        assert body["entries"][0]["entry_id"] == "e1"

    def test_pull_returns_only_the_delta(self, client, auth):
        """Le delta évite de retélécharger tout le carnet, et la facture réseau
        d'un téléphone avec."""
        push(client, auth, [entry("a")], base_revision=0)
        first = client.get("/v1/vault", headers=auth).json()["revision"]

        push(client, auth, [entry("b")], base_revision=first)
        delta = client.get(f"/v1/vault?since={first}", headers=auth).json()

        assert [e["entry_id"] for e in delta["entries"]] == ["b"]

    def test_tombstones_propagate(self, client, auth):
        """Une suppression doit atteindre les autres appareils, sinon elle
        serait annulée à la fusion suivante."""
        push(client, auth, [entry("a")])
        revision = client.get("/v1/vault", headers=auth).json()["revision"]
        push(client, auth, [entry("a", deleted=True)], base_revision=revision)

        entries = client.get("/v1/vault", headers=auth).json()["entries"]
        assert entries[0]["deleted"] is True


class TestConcurrency:
    def test_stale_write_is_refused(self, client, auth):
        """Écraser reviendrait à perdre en silence ce qu'un autre appareil a
        écrit entre-temps."""
        push(client, auth, [entry("a")], base_revision=0)
        # Le deuxième appareil croit encore être à la révision 0.
        response = push(client, auth, [entry("b")], base_revision=0)
        assert response.status_code == 409
        assert "pull" in response.json()["detail"].lower()

    def test_revision_advances_on_each_write(self, client, auth):
        first = push(client, auth, [entry("a")], base_revision=0).json()["revision"]
        second = push(client, auth, [entry("b")], base_revision=first).json()["revision"]
        assert second > first


class TestQuotas:
    def test_oversized_blob_is_refused(self, client, auth, settings):
        response = push(client, auth, [entry(blob=b"x" * (settings.max_blob_bytes + 1))])
        assert response.status_code == 413
        # Le carnet stocke des métadonnées, pas des fichiers.
        assert "volumineuse" in response.json()["detail"]

    def test_entry_limit_is_enforced(self, client, auth, settings):
        batch = [entry(f"e{i}") for i in range(settings.max_entries_per_account + 1)]
        assert push(client, auth, batch).status_code == 403


class TestIsolation:
    def test_an_account_never_sees_another(self, client):
        """La garantie qui compte le plus après le chiffrement."""
        first = client.post(
            "/v1/auth/register",
            json={"email": "a@example.com", "password": "mot-de-passe-de-test"},
        ).json()
        second = client.post(
            "/v1/auth/register",
            json={"email": "b@example.com", "password": "mot-de-passe-de-test"},
        ).json()

        push(client, {"Authorization": f"Bearer {first['access_token']}"}, [entry("secret")])

        seen = client.get(
            "/v1/vault", headers={"Authorization": f"Bearer {second['access_token']}"}
        ).json()
        assert seen["entries"] == []

    @pytest.mark.parametrize("method,path", [("get", "/v1/vault"), ("delete", "/v1/vault")])
    def test_requires_authentication(self, client, method, path):
        assert getattr(client, method)(path).status_code == 401

    def test_push_requires_authentication(self, client):
        assert client.post("/v1/vault", json={"base_revision": 0, "entries": []}).status_code == 401


class TestOpacity:
    def test_the_server_stores_what_it_is_given(self, client, auth, db_session):
        """Le serveur ne déchiffre rien : il doit accepter n'importe quels
        octets, et les rendre à l'identique."""
        from thecode_api.models import VaultEntry

        payload = bytes(range(256))
        push(client, auth, [entry(blob=payload)])

        stored = db_session.query(VaultEntry).one()
        assert stored.blob == payload

    def test_invalid_base64_is_refused(self, client, auth):
        bad = {"entry_id": "e1", "nonce": "!!!", "blob": "!!!", "deleted": False}
        assert push(client, auth, [bad]).status_code == 422


class TestPurge:
    def test_removes_everything(self, client, auth):
        push(client, auth, [entry("a"), entry("b")])
        assert client.delete("/v1/vault", headers=auth).status_code == 204
        assert client.get("/v1/vault", headers=auth).json()["entries"] == []
