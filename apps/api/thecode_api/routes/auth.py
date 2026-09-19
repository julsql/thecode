"""Inscription, connexion, renouvellement."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DbSession

from .. import codes as code_rules
from ..auth import (
    _as_utc,
    create_access_token,
    current_account,
    find_valid_session,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from ..config import get_settings
from ..db import get_db
from ..mailer import send_verification_email
from ..models import Account, EmailVerification, Session
from ..plans import active_device_count, limits_for, live_entry_count
from ..schemas import (
    AccountResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    TokenResponse,
    VerifyRequest,
)

router = APIRouter(prefix="/v1/auth", tags=["auth"])


def account_response(db: DbSession, account: Account) -> AccountResponse:
    """La vue du compte telle que le site l'affiche.

    Une seule construction pour tout le monde : les plafonds affichés doivent
    être ceux que le serveur applique, sinon l'utilisateur découvre la vraie
    limite en se la prenant.
    """
    settings = get_settings()
    limits = limits_for(account, settings)
    return AccountResponse(
        email=account.email,
        plan=limits.plan,
        subscription_status=account.subscription_status,
        revision=account.revision,
        entry_count=live_entry_count(db, account),
        max_entries=limits.max_entries,
        email_verified=account.email_verified_at is not None,
        plan_source=account.plan_source,
        device_count=active_device_count(db, account),
        max_devices=limits.max_devices,
        current_period_end=account.current_period_end,
        has_pending_coupon=bool(account.pending_coupon),
        billing_available=settings.billing_enabled,
    )


def _enforce_device_limit(db: DbSession, account: Account) -> None:
    """Refuse une connexion de plus que ce que l'offre autorise.

    Refuser plutôt que déconnecter le plus ancien appareil : un utilisateur
    dont le téléphone se déconnecte tout seul pendant qu'il travaille sur le
    site ne comprendrait pas, et la synchronisation est précisément ce qu'il
    paie.
    """
    settings = get_settings()
    limits = limits_for(account, settings)
    if active_device_count(db, account) < limits.max_devices:
        return

    site = settings.site_url.rstrip("/")
    raise HTTPException(
        status.HTTP_402_PAYMENT_REQUIRED,
        f"Offre {limits.plan} : {limits.max_devices} appareils connectés au maximum. "
        f"Déconnectez un appareil depuis votre compte sur {site}, "
        "ou passez à l'offre complète.",
    )


def _send_verification(db: DbSession, account: Account, lang: str) -> None:
    """Crée un lien de vérification et l'envoie.

    Les liens précédents encore valables sont invalidés : deux liens vivants
    pour la même adresse, c'est une surface d'attaque de plus sans aucun
    bénéfice.
    """
    settings = get_settings()
    db.query(EmailVerification).filter(
        EmailVerification.account_id == account.id,
        EmailVerification.used_at.is_(None),
    ).delete()

    token, token_hash = new_refresh_token()
    db.add(
        EmailVerification(
            account_id=account.id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(hours=settings.email_verification_hours),
        )
    )
    db.commit()
    send_verification_email(settings, account.email, token, lang)


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


@router.get("/registration")
def registration_state(db: DbSession = Depends(get_db)) -> dict[str, object]:
    """Dit ce que l'inscription demande, sans rien révéler de plus.

    Le formulaire doit savoir s'il faut réclamer un code avant de le
    demander : exiger un code sans raison, ou en cacher la nécessité jusqu'au
    refus, sont aussi désagréables l'un que l'autre.

    Le nombre de comptes existants n'est pas rendu : il ne regarde personne.
    """
    settings = get_settings()

    if settings.registration_closed:
        return {"open": False, "needsCode": True, "freeSlots": 0}
    if settings.registration_open:
        return {"open": True, "needsCode": False, "freeSlots": None}
    if not settings.registration_quota:
        return {"open": True, "needsCode": True, "freeSlots": None}

    taken = db.scalar(select(func.count()).select_from(Account)) or 0
    free = max(0, settings.free_accounts - taken)
    return {"open": True, "needsCode": free == 0, "freeSlots": free}


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DbSession = Depends(get_db)) -> TokenResponse:
    settings = get_settings()

    if settings.registration_closed:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Les inscriptions sont fermées pour le moment."
        )

    # En mode quota, les premiers comptes se créent sans rien ; au-delà il faut
    # un code. Le compte se fait sur les comptes existants, pas sur un compteur
    # à part : un compte supprimé doit libérer sa place.
    needs_code = not settings.registration_open
    if settings.registration_quota:
        taken = db.scalar(select(func.count()).select_from(Account)) or 0
        needs_code = taken >= settings.free_accounts

    # Deux sources de codes valables : celui de la configuration, qui ouvre le
    # service sans rien donner de plus, et ceux de la base, qui portent un
    # effet (remise, offre à vie). Le second est cherché même quand aucun code
    # n'est exigé : quelqu'un qui saisit un code à vie sur une inscription
    # libre doit l'obtenir, pas le perdre.
    #
    # compare_digest : la comparaison ne doit pas fuir le code par le temps
    # qu'elle prend.
    env_code_ok = bool(settings.invite_code) and secrets.compare_digest(
        payload.invite_code, settings.invite_code
    )
    stored_code = code_rules.find_usable(db, payload.invite_code) if payload.invite_code else None

    if needs_code and not env_code_ok and stored_code is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Code de parrainage invalide."
            if settings.registration_quota
            else "Code d'invitation invalide.",
        )

    account = Account(email=payload.email.lower(), password_hash=hash_password(payload.password))
    db.add(account)
    try:
        db.flush()
        if stored_code is not None:
            code_rules.redeem(db, account, stored_code)
        db.commit()
    except IntegrityError:
        db.rollback()
        # Message identique à une inscription réussie du point de vue d'un
        # attaquant ? Non : l'unicité de l'email est observable de toute façon
        # à la connexion. Autant être clair plutôt que faussement discret.
        raise HTTPException(status.HTTP_409_CONFLICT, "Cette adresse est déjà inscrite") from None

    # Après le compte, jamais avant : envoyer un lien pour un compte qui n'a
    # pas pu être créé promènerait l'utilisateur pour rien.
    _send_verification(db, account, payload.lang)

    return _issue_tokens(db, account, payload.device_label)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession = Depends(get_db)) -> TokenResponse:
    account = db.query(Account).filter(Account.email == payload.email.lower()).one_or_none()

    # Le hachage est fait même sans compte, pour que la durée de la réponse ne
    # dise pas si l'adresse existe.
    stored = account.password_hash if account else hash_password("mot-de-passe-factice")
    if not verify_password(payload.password, stored) or account is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Identifiants invalides")

    _enforce_device_limit(db, account)
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
    return account_response(db, account)


@router.post("/verify", status_code=status.HTTP_200_OK)
def verify_email(payload: VerifyRequest, db: DbSession = Depends(get_db)) -> dict[str, bool]:
    """Confirme une adresse à partir du lien reçu.

    Sans authentification : le lien arrive dans une boîte, souvent ouverte sur
    un autre appareil que celui qui s'est inscrit. Le jeton fait la preuve.
    """
    token_hash = hash_refresh_token(payload.token)
    row = db.scalars(
        select(EmailVerification).where(EmailVerification.token_hash == token_hash)
    ).one_or_none()

    now = datetime.now(UTC)
    if row is None or row.used_at is not None or _as_utc(row.expires_at) <= now:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Lien de vérification invalide ou expiré. Demandez-en un nouveau "
            "depuis votre compte.",
        )

    account = db.get(Account, row.account_id)
    row.used_at = now
    if account is not None and account.email_verified_at is None:
        account.email_verified_at = now
    db.commit()
    return {"verified": True}


@router.post("/verify/resend", status_code=status.HTTP_202_ACCEPTED)
def resend_verification(
    payload: ResendVerificationRequest,
    account: Account = Depends(current_account),
    db: DbSession = Depends(get_db),
) -> dict[str, bool]:
    if account.email_verified_at is not None:
        return {"sent": False}
    _send_verification(db, account, payload.lang)
    return {"sent": True}
