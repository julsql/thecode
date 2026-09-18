"""Authentification.

Le compte de synchronisation est délibérément distinct de la clef maîtresse :
celle-ci ne doit jamais servir à s'authentifier, sinon une faiblesse du service
exposerait les mots de passe eux-mêmes.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session as DbSession

from .config import get_settings
from .db import get_db
from .models import Account, Session

# Paramètres OWASP pour Argon2id. Contrairement aux clients, le serveur peut
# s'offrir un vrai KDF mémoire-dur : il hache un mot de passe de compte, pas
# une clef maîtresse, et le coût est borné par le nombre de connexions.
_hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)

_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        _hasher.verify(stored_hash, password)
        return True
    except VerifyMismatchError:
        return False
    except Exception:  # noqa: BLE001 - un hash illisible doit refuser, pas remonter
        # Hash corrompu, tronque, ou produit par un autre algorithme : on
        # refuse. Laisser l'exception remonter donnerait un 500 la ou un 401
        # est la bonne reponse.
        return False


def new_refresh_token() -> tuple[str, str]:
    """Retourne (jeton en clair, empreinte à stocker).

    Le jeton n'est stocké que haché : une fuite de la base ne doit pas
    permettre de se connecter.
    """
    token = secrets.token_urlsafe(48)
    return token, hashlib.sha256(token.encode()).hexdigest()


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(account_id: uuid.UUID) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(account_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def current_account(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: DbSession = Depends(get_db),
) -> Account:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentification requise")

    settings = get_settings()
    try:
        payload = jwt.decode(
            credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Jeton expiré") from None
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Jeton invalide") from None

    account = db.get(Account, uuid.UUID(payload["sub"]))
    if account is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Compte introuvable")
    return account


def _as_utc(value: datetime) -> datetime:
    """Ramène un horodatage en UTC conscient du fuseau.

    Certains moteurs — SQLite notamment — ne conservent pas le fuseau. Comparer
    un horodatage naïf à un horodatage conscient lève une TypeError, ce qui
    ferait échouer une expiration de session au lieu de la traiter.
    """
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def revoke_expired_sessions(db: DbSession, account: Account) -> None:
    now = datetime.now(UTC)
    for session in account.sessions:
        if _as_utc(session.expires_at) < now:
            session.revoked = True


def find_valid_session(db: DbSession, token: str) -> Session | None:
    session = (
        db.query(Session).filter(Session.token_hash == hash_refresh_token(token)).one_or_none()
    )
    if session is None or session.revoked:
        return None
    if _as_utc(session.expires_at) < datetime.now(UTC):
        return None
    return session
