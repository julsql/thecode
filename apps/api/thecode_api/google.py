"""Vérification des jetons « Se connecter avec Google ».

Le navigateur obtient un jeton d'identité auprès de Google et nous l'envoie.
Tout se joue ici : un jeton mal vérifié, et n'importe qui entre avec n'importe
quel compte.

La signature est contrôlée contre les clefs publiques de Google, pas auprès
d'un point de terminaison de vérification : c'est la méthode recommandée, elle
ne dépend pas d'un appel réseau à chaque connexion, et le cache des clefs est
tenu par la bibliothèque.

Trois contrôles comptent autant l'un que l'autre :

- la **signature**, sinon le jeton est une simple chaîne que l'on fabrique ;
- l'**audience**, sinon un jeton émis pour une autre application ouvrirait nos
  comptes ;
- l'**émetteur**, pour la même raison.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import jwt
from jwt import PyJWKClient

from .config import Settings

JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
ISSUERS = ("accounts.google.com", "https://accounts.google.com")


class GoogleError(Exception):
    """Jeton refusé. Le détail ne sort jamais tel quel côté client."""


@dataclass(frozen=True)
class GoogleIdentity:
    #: Identifiant stable du compte Google. C'est lui qui fait le lien, pas
    #: l'adresse : Google permet d'en changer, et une adresse réattribuée à
    #: quelqu'un d'autre lui ouvrirait le compte.
    sub: str
    email: str


@lru_cache(maxsize=1)
def _keys() -> PyJWKClient:
    # Le client garde les clefs en mémoire : Google les fait tourner, mais pas
    # à chaque connexion, et les retélécharger à chaque fois ajouterait une
    # dépendance réseau à toute ouverture de session.
    return PyJWKClient(JWKS_URL, cache_keys=True)


def verify_id_token(raw: str, settings: Settings) -> GoogleIdentity:
    if not settings.google_enabled:
        raise GoogleError("La connexion Google n'est pas configurée.")

    try:
        signing_key = _keys().get_signing_key_from_jwt(raw)
        claims = jwt.decode(
            raw,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except Exception as exc:
        raise GoogleError(f"Jeton Google invalide : {exc}") from exc

    if claims.get("iss") not in ISSUERS:
        raise GoogleError("Émetteur inattendu.")

    email = str(claims.get("email", "")).lower()
    if not email:
        raise GoogleError("Ce compte Google ne fournit pas d'adresse.")

    # Une adresse non vérifiée par Google ne vaut pas preuve : elle pourrait
    # être celle de quelqu'un d'autre, et servirait alors à s'emparer du compte
    # correspondant chez nous.
    if not claims.get("email_verified"):
        raise GoogleError("Cette adresse Google n'est pas vérifiée.")

    return GoogleIdentity(sub=str(claims["sub"]), email=email)
