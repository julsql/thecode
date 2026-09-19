"""Fixtures de test.

Les tests tournent sur **PostgreSQL**, le moteur de production, démarré dans un
conteneur jetable.

SQLite serait plus rapide, mais tester sur un autre moteur que celui déployé
revient à ne pas tester : les types, les contraintes, les cascades et la gestion
des fuseaux horaires diffèrent, et un comportement cassé en production peut très
bien passer sur SQLite.
"""

from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import thecode_api
import thecode_api.routes.auth as auth_routes
from thecode_api import models
from thecode_api.config import Settings, get_settings
from thecode_api.db import get_db
from thecode_api.main import app


@pytest.fixture(scope="session")
def postgres_url() -> str:
    """URL d'un PostgreSQL de test.

    THECODE_TEST_DATABASE_URL permet de pointer une base déjà lancée — ce que
    fait la CI avec son service `postgres`, plutôt que d'imbriquer un conteneur
    dans un conteneur.
    """
    existing = os.environ.get("THECODE_TEST_DATABASE_URL")
    if existing:
        # `yield` et non `return` : dans un générateur, un return ne fournit
        # aucune valeur à pytest. Le bug ne se voyait pas en local, où la
        # variable n'est pas définie et où l'on passe par testcontainers.
        yield existing
        return

    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:16-alpine", driver="psycopg") as container:
        yield container.get_connection_url()


@pytest.fixture(scope="session")
def engine(postgres_url):
    engine = create_engine(postgres_url, pool_pre_ping=True)
    models.Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


def _modules_reading_settings():
    """Les modules du service qui ont importé `get_settings`."""
    import importlib
    import pkgutil

    found = []
    for info in pkgutil.walk_packages(thecode_api.__path__, f"{thecode_api.__name__}."):
        # Sauf le module qui la définit : y substituer une lambda enlèverait
        # `cache_clear`, dont les tests de configuration ont besoin.
        if info.name == "thecode_api.config":
            continue
        module = importlib.import_module(info.name)
        if hasattr(module, "get_settings"):
            found.append(module)
    return found


@pytest.fixture(autouse=True)
def settings(postgres_url):
    """Réglages de test, avec un secret explicite et des quotas bas."""
    get_settings.cache_clear()
    test_settings = Settings(
        database_url=postgres_url,
        jwt_secret="secret-de-test-uniquement",
        environment="test",
        max_entries_per_account=50,
        max_blob_bytes=1024,
        # Explicite : le mode par défaut est `invite`, et un test qui s'inscrit
        # sans code doit le faire parce que le service est ouvert, pas parce
        # que le code attendu se trouve être vide.
        registration_mode="open",
        # Les offres s'appliquent : la plupart des tests décrivent ce qui se
        # passe quand elles comptent. Le défaut du service est l'inverse —
        # tout ouvert — et les tests qui visent ce cas le posent eux-mêmes.
        plans_enabled=True,
        # Les plafonds de l'offre gratuite ne doivent pas gêner les tests qui
        # parlent d'autre chose ; ceux qui les visent les abaissent eux-mêmes.
        free_max_entries=50,
        free_max_devices=10,
    )
    # Tous les modules du paquet, pas une liste tenue à la main : chacun
    # importe `get_settings` par valeur, et un module oublié dans la liste
    # lisait la vraie configuration — ce qui se voyait sous la forme de
    # cinquante tests rouges pour une raison sans rapport.
    for module in _modules_reading_settings():
        module.get_settings = lambda: test_settings

    yield test_settings
    get_settings.cache_clear()


@pytest.fixture
def db_session(engine):
    """Une session sur une base vidée entre chaque test.

    TRUNCATE plutôt que de recréer le schéma : bien plus rapide, et les
    séquences repartent de zéro.
    """
    with engine.begin() as connection:
        connection.execute(
            # `codes` figure explicitement : CASCADE ne vide que les tables qui
            # référencent celles citées, et les codes ne référencent aucun compte.
            text(
                "TRUNCATE accounts, vault_entries, sessions, codes "
                "RESTART IDENTITY CASCADE"
            )
        )

    session = sessionmaker(bind=engine, expire_on_commit=False)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def account(client):
    """Un compte inscrit, avec ses jetons."""
    response = client.post(
        "/v1/auth/register",
        json={"email": f"{uuid.uuid4().hex}@example.com", "password": "mot-de-passe-de-test"},
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def auth(account):
    return {"Authorization": f"Bearer {account['access_token']}"}


@pytest.fixture
def sent_emails(monkeypatch):
    """Capture les courriers au lieu de les envoyer.

    Les trois : confirmation d'adresse, changement d'adresse,
    réinitialisation. Le jeton n'est stocké que haché — sans cette capture,
    aucun test ne pourrait suivre un lien, c'est-à-dire tester ce qui compte.

    L'adresse enregistrée est celle **visée** par l'envoi : un changement
    d'adresse doit partir vers la nouvelle, et c'est précisément ce qu'un test
    vérifie.
    """
    import thecode_api.routes.account as account_routes

    sent: list[dict[str, str]] = []

    def capture(settings, email, token, lang="en"):
        sent.append({"email": email, "token": token, "lang": lang})

    monkeypatch.setattr(auth_routes, "send_verification_email", capture)
    monkeypatch.setattr(auth_routes, "send_password_reset_email", capture)
    monkeypatch.setattr(account_routes, "send_email_change_email", capture)
    return sent
