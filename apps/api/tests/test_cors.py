"""En-têtes CORS.

L'API vit sur son propre sous-domaine : le site n'est plus sur la même origine
et le navigateur bloquerait ses requêtes sans ces en-têtes. Les applications
natives et les extensions, elles, ne passent pas par le CORS.
"""

from __future__ import annotations

from thecode_api.config import Settings


def test_allows_the_website_origin(client):
    response = client.options(
        "/v1/vault",
        headers={
            "Origin": "https://thecode.julsql.fr",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://thecode.julsql.fr"
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_refuses_an_unknown_origin(client):
    response = client.options(
        "/v1/vault",
        headers={
            "Origin": "https://exemple-hostile.fr",
            "Access-Control-Request-Method": "GET",
        },
    )

    # Starlette répond 400 au préalable ; l'essentiel est qu'aucun en-tête
    # n'autorise l'origine.
    assert "access-control-allow-origin" not in response.headers


def test_does_not_allow_credentials():
    """Aucune requête n'utilise de cookie : les jetons sont dans l'en-tête.

    Autoriser les identifiants obligerait à renvoyer une origine précise et
    ouvrirait la porte aux requêtes authentifiées par cookie depuis un autre
    site.
    """
    response_headers = Settings().cors_origin_list
    assert response_headers == ["https://thecode.julsql.fr"]


def test_origins_can_be_listed_in_the_environment(monkeypatch):
    monkeypatch.setenv("THECODE_CORS_ORIGINS", "https://a.fr, https://b.fr")
    assert Settings().cors_origin_list == ["https://a.fr", "https://b.fr"]


def test_root_path_is_empty_by_default(monkeypatch):
    # Le service est à la racine de son sous-domaine.
    monkeypatch.delenv("THECODE_ROOT_PATH", raising=False)
    assert Settings().root_path == ""
