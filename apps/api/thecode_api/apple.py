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

**Révocation** (TN3194) : Apple exige qu'une application proposant « Se
connecter avec Apple » révoque les jetons de l'utilisateur quand il supprime
son compte. À la connexion, le client joint le code d'autorisation ; le
serveur l'échange contre un jeton de renouvellement (`/auth/token`) et le
garde. À la suppression du compte, ou quand Apple est délié, il le révoque
(`/auth/revoke`). Les deux appels s'authentifient par un `client_secret` : un
JWT ES256 signé avec la clef « Sign in with Apple » de l'équipe. Tout cela est
au mieux : un échec est journalisé, jamais bloquant.
"""

from __future__ import annotations

import hashlib
import json
import logging
import secrets
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from functools import lru_cache

import jwt
from jwt import PyJWKClient

from .config import Settings
from .models import Account

JWKS_URL = "https://appleid.apple.com/auth/keys"
ISSUER = "https://appleid.apple.com"
TOKEN_URL = "https://appleid.apple.com/auth/token"
REVOKE_URL = "https://appleid.apple.com/auth/revoke"
#: Apple refuse un `client_secret` valable plus de six mois ; il est signé à
#: chaque appel, une durée courte suffit.
CLIENT_SECRET_SECONDS = 5 * 60

logger = logging.getLogger("thecode.apple")


class AppleError(Exception):
    """Jeton refusé. Le détail ne sort jamais tel quel côté client."""


@dataclass(frozen=True)
class AppleIdentity:
    #: Identifiant stable de l'utilisateur pour notre équipe de développeur.
    #: C'est lui qui fait le lien, pas l'adresse.
    sub: str
    #: Vide quand le jeton n'en porte pas, ou qu'Apple ne la dit pas vérifiée.
    email: str
    #: L'audience du jeton, c'est-à-dire le client (bundle id ou Services ID)
    #: au nom duquel le code d'autorisation s'échange.
    audience: str = ""


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

    aud = claims["aud"]
    if isinstance(aud, list):
        aud = next((a for a in aud if a in settings.apple_audiences), "")
    return AppleIdentity(sub=sub, email=email, audience=str(aud))


def client_secret(settings: Settings, client_id: str, now: int | None = None) -> str:
    """Le `client_secret` qu'Apple attend : un JWT ES256 signé par la clef
    « Sign in with Apple » de l'équipe."""
    issued = int(time.time()) if now is None else now
    # Une clef collée sur une seule ligne garde ses retours à la ligne sous
    # forme de « \n » littéraux.
    key = settings.apple_private_key.replace("\\n", "\n")
    return jwt.encode(
        {
            "iss": settings.apple_team_id,
            "iat": issued,
            "exp": issued + CLIENT_SECRET_SECONDS,
            "aud": ISSUER,
            "sub": client_id,
        },
        key,
        algorithm="ES256",
        headers={"kid": settings.apple_key_id},
    )


def _post_form(url: str, data: dict[str, str]) -> dict[str, object]:
    """POST `application/x-www-form-urlencoded`, réponse JSON. Remplacé en test."""
    request = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(data).encode("ascii"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        body = response.read()
    return json.loads(body) if body else {}


def exchange_code(settings: Settings, client_id: str, code: str) -> str:
    """Échange un code d'autorisation contre un jeton de renouvellement."""
    try:
        answer = _post_form(
            TOKEN_URL,
            {
                "grant_type": "authorization_code",
                "client_id": client_id,
                "client_secret": client_secret(settings, client_id),
                "code": code,
            },
        )
    except Exception as exc:
        raise AppleError(f"Échange du code refusé : {exc}") from exc
    token = answer.get("refresh_token")
    if not isinstance(token, str) or not token:
        raise AppleError("Réponse d'Apple sans jeton de renouvellement.")
    return token


def revoke_token(settings: Settings, client_id: str, token: str) -> None:
    try:
        _post_form(
            REVOKE_URL,
            {
                "client_id": client_id,
                "client_secret": client_secret(settings, client_id),
                "token": token,
                "token_type_hint": "refresh_token",
            },
        )
    except Exception as exc:
        raise AppleError(f"Révocation refusée : {exc}") from exc


def remember_refresh_token(settings: Settings, account: Account, client_id: str, code: str) -> None:
    """Au mieux : échange le code et garde le jeton sur le compte (sans
    commit). Un échec n'empêche jamais la connexion."""
    if not code:
        return
    if not settings.apple_revocation_enabled:
        logger.info("Clef Apple absente : code d'autorisation ignoré.")
        return
    if not client_id:
        logger.warning("Audience Apple inconnue : code d'autorisation ignoré.")
        return
    try:
        token = exchange_code(settings, client_id, code)
    except AppleError as exc:
        logger.warning("Jeton Apple non obtenu : %s", exc)
        return
    account.apple_refresh_token = token
    account.apple_client_id = client_id


def revoke_account_tokens(settings: Settings, account: Account) -> None:
    """Au mieux : révoque le jeton gardé, puis l'oublie (sans commit). Un
    échec est journalisé, jamais bloquant."""
    token = account.apple_refresh_token
    if not token:
        return
    if not settings.apple_revocation_enabled:
        logger.warning("Clef Apple absente : jeton Apple non révoqué.")
    else:
        try:
            revoke_token(settings, account.apple_client_id, token)
        except AppleError as exc:
            logger.warning("Jeton Apple non révoqué : %s", exc)
    account.apple_refresh_token = ""
    account.apple_client_id = ""
