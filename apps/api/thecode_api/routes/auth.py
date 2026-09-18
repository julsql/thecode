"""Inscription, connexion, renouvellement."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DbSession

from ..auth import (
    create_access_token,
    current_account,
    find_valid_session,
    hash_password,
    new_refresh_token,
    verify_password,
)
from ..config import get_settings
from ..db import get_db
from ..models import Account, Session
from ..schemas import (
    AccountResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)

router = APIRouter(prefix="/v1/auth", tags=["auth"])


def _issue_tokens(db: DbSession, account: Account, device_label: str = "") -> TokenResponse:
    settings = get_settings()
    token, token_hash = new_refresh_token()

    db.add(
        Session(
            account_id=account.id,
            token_hash=token_hash,
            label=device_label[:120],
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
        )
    )
    db.commit()

    return TokenResponse(
        access_token=create_access_token(account.id),
        refresh_token=token,
        expires_in=settings.access_token_minutes * 60,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DbSession = Depends(get_db)) -> TokenResponse:
    settings = get_settings()

    if settings.registration_closed:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Les inscriptions sont fermées pour le moment."
        )

    # compare_digest : la comparaison ne doit pas fuir le code par le temps
    # qu'elle prend.
    if not settings.registration_open and not secrets.compare_digest(
        payload.invite_code, settings.invite_code
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Code d'invitation invalide.")

    account = Account(email=payload.email.lower(), password_hash=hash_password(payload.password))
    db.add(account)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Message identique à une inscription réussie du point de vue d'un
        # attaquant ? Non : l'unicité de l'email est observable de toute façon
        # à la connexion. Autant être clair plutôt que faussement discret.
        raise HTTPException(status.HTTP_409_CONFLICT, "Cette adresse est déjà inscrite") from None

    return _issue_tokens(db, account)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession = Depends(get_db)) -> TokenResponse:
    account = db.query(Account).filter(Account.email == payload.email.lower()).one_or_none()

    # Le hachage est fait même sans compte, pour que la durée de la réponse ne
    # dise pas si l'adresse existe.
    stored = account.password_hash if account else hash_password("mot-de-passe-factice")
    if not verify_password(payload.password, stored) or account is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Identifiants invalides")

    return _issue_tokens(db, account, payload.device_label)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: DbSession = Depends(get_db)) -> TokenResponse:
    session = find_valid_session(db, payload.refresh_token)
    if session is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Jeton de renouvellement invalide")

    # Rotation : l'ancien jeton est révoqué. S'il resservait, un jeton
    # intercepté resterait valable jusqu'à son expiration.
    session.revoked = True
    account = db.get(Account, session.account_id)
    return _issue_tokens(db, account, session.label)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshRequest, db: DbSession = Depends(get_db)) -> None:
    session = find_valid_session(db, payload.refresh_token)
    if session is not None:
        session.revoked = True
        db.commit()


@router.get("/me", response_model=AccountResponse)
def me(
    account: Account = Depends(current_account), db: DbSession = Depends(get_db)
) -> AccountResponse:
    settings = get_settings()
    return AccountResponse(
        email=account.email,
        plan=account.plan,
        subscription_status=account.subscription_status,
        revision=account.revision,
        entry_count=len([e for e in account.entries if not e.deleted]),
        max_entries=settings.max_entries_per_account,
    )
