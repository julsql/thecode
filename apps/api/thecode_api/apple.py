"""Vérification des jetons « Se connecter avec Apple ».

Les applications iOS et macOS obtiennent un jeton d'identité par
`ASAuthorizationAppleIDProvider` et nous l'envoient. Même logique que Google
(voir `google.py`) : signature contre les clefs publiques d'Apple, émetteur,
audience, expiration.

L'audience est l'identifiant de l'application (le bundle id) pour un jeton
obtenu nativement, ou un « Services ID » pour un flux web. Plusieurs peuvent
être acceptés (`apple_client_ids`).

Le **nonce** suit la convention d'Apple : le client tire un nonce brut, passe
son empreinte SHA-256 (hexadécimal) à `ASAuthorizationAppleIDRequest.nonce`,
et Apple recopie cette empreinte dans le jeton. Le client nous envoie le nonce
**brut** ; nous le hachons et comparons. Qui intercepte le jeton ne connaît pas
le nonce brut, et ne peut donc pas le rejouer.

L'adresse n'est pas toujours là : Apple ne l'inclut que si l'utilisateur l'a
partagée, et elle peut être un relais `@privaterelay.appleid.com` — une vraie
adresse, vérifiée par Apple, qui fait suivre le courrier.
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from functools import lru_cache

import jwt
from jwt import PyJWKClient

from .config import Settings

JWKS_URL = "https://appleid.apple.com/auth/keys"
ISSUER = "https://appleid.apple.com"


class AppleError(Exception):
    """Jeton refusé. Le détail ne sort jamais tel quel côté client."""


@dataclass(frozen=True)
class AppleIdentity:
    #: Identifiant stable de l'utilisateur pour notre équipe de développeur.
    #: C'est lui qui fait le lien, pas l'adresse.
    sub: str
    #: Vide quand le jeton n'en porte pas, ou qu'Apple ne la dit pas vérifiée.
    email: str


@lru_cache(maxsize=1)
def _keys() -> PyJWKClient:
    # Comme pour Google : clefs gardées en mémoire, retéléchargées seulement
    # quand un `kid` inconnu apparaît.
    return PyJWKClient(JWKS_URL, cache_keys=True)


def hash_nonce(raw: str) -> str:
    """L'empreinte que le client a passée à Apple : SHA-256, hexadécimal."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _is_true(value: object) -> bool:
    # Apple envoie `email_verified` tantôt en booléen, tantôt en chaîne.
    return value is True or (isinstance(value, str) and value.lower() == "true")


def verify_identity_token(raw: str, settings: Settings, nonce: str = "") -> AppleIdentity:
    if not settings.apple_enabled:
        raise AppleError("La connexion Apple n'est pas configurée.")

    try:
        signing_key = _keys().get_signing_key_from_jwt(raw)
        claims = jwt.decode(
            raw,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.apple_audiences,
            issuer=ISSUER,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except Exception as exc:
        raise AppleError(f"Jeton Apple invalide : {exc}") from exc

    # Seulement quand le client en a envoyé un ; mais alors le jeton doit
    # porter son empreinte, et un jeton sans nonce ne passe pas non plus.
    if nonce and not secrets.compare_digest(str(claims.get("nonce", "")), hash_nonce(nonce)):
        raise AppleError("Nonce inattendu.")

    sub = str(claims["sub"])
    if not sub:
        raise AppleError("Jeton sans identifiant.")

    email = str(claims.get("email", "")).lower()
    # Une adresse non vérifiée ne sert ni à relier ni à créer un compte.
    if not _is_true(claims.get("email_verified")):
        email = ""

    return AppleIdentity(sub=sub, email=email)
