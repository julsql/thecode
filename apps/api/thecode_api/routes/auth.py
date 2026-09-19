"""Inscription, connexion, renouvellement."""

from __future__ import annotations

import logging
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DbSession

from .. import codes as code_rules
from ..auth import (
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
from ..google import GoogleError, verify_id_token
from ..links import consume_link, new_link
from ..mailer import MailError, send_password_reset_email, send_verification_email
from ..models import Account, EmailVerification, Session
from ..plans import active_device_count, limits_for, live_entry_count
from ..schemas import (
    AccountResponse,
    ForgotPasswordRequest,
    GoogleRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyRequest,
)

router = APIRouter(prefix="/v1/auth", tags=["auth"])
logger = logging.getLogger("thecode.auth")


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
        plans_enforced=settings.plans_enabled,
        has_password=bool(account.password_hash),
        google_linked=bool(account.google_sub),
        pending_email=pending_email(db, account),
    )


def pending_email(db: DbSession, account: Account) -> str:
    """L'adresse en attente de confirmation, s'il y en a une.

    Affichée au compte : une demande oubliée qui ne se voit nulle part laisse
    croire que le changement n'a pas été pris, et on la refait.
    """
    row = db.scalars(
        select(EmailVerification)
        .where(
            EmailVerification.account_id == account.id,
            EmailVerification.purpose == "change",
            EmailVerification.used_at.is_(None),
            EmailVerification.expires_at > datetime.now(UTC),
        )
        .order_by(EmailVerification.created_at.desc())
    ).first()
    return row.new_email if row is not None else ""


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
        f"Déconnectez un appareil depuis votre compte sur {site}.",
    )


def _send_verification(db: DbSession, account: Account, lang: str, strict: bool = False) -> None:
    """Crée un lien de confirmation et l'envoie.

    `strict` décide de ce qu'on fait d'un envoi raté. À l'inscription, non :
    le compte existe, il fonctionne, et le lien se redemande — refuser
    l'inscription parce que le serveur de courrier tousse serait pire. Sur une
    demande explicite de renvoi, oui : sinon on répond « envoyé » à quelqu'un
    qui n'aura jamais rien.
    """
    token = new_link(db, account, "verify")
    try:
        send_verification_email(get_settings(), account.email, token, lang)
    except MailError:
        if strict:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "L'envoi du courrier a échoué. Réessayez dans un moment.",
            ) from None
        logger.error("Lien de confirmation non envoyé à %s", account.email)


def _issue_tokens(db: DbSession, account: Account, device_label: str = "") -> TokenResponse:
    settings = get_settings()
    token, token_hash = new_refresh_token()

    session = Session(
        account_id=account.id,
        token_hash=token_hash,
        label=device_label[:120],
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
    )
    db.add(session)
    # Le jeton d'accès porte l'identifiant de la session : c'est ce qui permet
    # de déconnecter les autres appareils sans se déconnecter soi-même.
    db.flush()
    db.commit()

    return TokenResponse(
        access_token=create_access_token(account.id, session.id),
        refresh_token=token,
        expires_in=settings.access_token_minutes * 60,
    )


def _check_registration(db: DbSession, invite_code: str):
    """Décide si l'inscription passe, et avec quel code.

    Deux sources de codes valables : celui de la configuration, qui ouvre le
    service sans rien donner de plus, et ceux de la base, qui portent un effet
    (remise, offre à vie). Le second est cherché même quand aucun code n'est
    exigé : quelqu'un qui saisit un code à vie sur une inscription libre doit
    l'obtenir, pas le perdre.

    Lève une 403 quand il en faut un et qu'aucun ne convient ; rend le code de
    la base quand il y en a un, pour que l'appelant en applique l'effet.
    """
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

    # compare_digest : la comparaison ne doit pas fuir le code par le temps
    # qu'elle prend.
    env_code_ok = bool(settings.invite_code) and secrets.compare_digest(
        invite_code, settings.invite_code
    )
    stored_code = code_rules.find_usable(db, invite_code) if invite_code else None

    if needs_code and not env_code_ok and stored_code is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Code de parrainage invalide."
            if settings.registration_quota
            else "Code d'invitation invalide.",
        )

    return stored_code


@router.get("/registration")
def registration_state(db: DbSession = Depends(get_db)) -> dict[str, object]:
    """Dit ce que l'inscription demande, sans rien révéler de plus.

    Le formulaire doit savoir s'il faut réclamer un code avant de le
    demander : exiger un code sans raison, ou en cacher la nécessité jusqu'au
    refus, sont aussi désagréables l'un que l'autre.

    Le nombre de comptes existants n'est pas rendu : il ne regarde personne.
    """
    settings = get_settings()

    # L'identifiant client Google est public par construction : il voyage dans
    # chaque page qui propose le bouton. Le donner ici évite de le recopier
    # dans le site, où il finirait par ne plus correspondre.
    google = settings.google_client_id

    if settings.registration_closed:
        return {"open": False, "needsCode": True, "freeSlots": 0, "googleClientId": google}
    if settings.registration_open:
        return {"open": True, "needsCode": False, "freeSlots": None, "googleClientId": google}
    if not settings.registration_quota:
        return {"open": True, "needsCode": True, "freeSlots": None, "googleClientId": google}

    taken = db.scalar(select(func.count()).select_from(Account)) or 0
    free = max(0, settings.free_accounts - taken)
    return {
        "open": True,
        "needsCode": free == 0,
        "freeSlots": free,
        "googleClientId": google,
    }


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DbSession = Depends(get_db)) -> TokenResponse:
    stored_code = _check_registration(db, payload.invite_code)

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
    stored = (
        account.password_hash
        if account and account.password_hash
        else hash_password("mot-de-passe-factice")
    )
    valid = verify_password(payload.password, stored)

    # Un compte créé par Google n'a pas de mot de passe. Répondre « identifiants
    # invalides » enverrait son propriétaire chercher une faute de frappe dans
    # un mot de passe qui n'existe pas.
    if account is not None and not account.password_hash:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Ce compte se connecte avec Google. Depuis votre compte sur le site, "
            "définissez un mot de passe pour l'utiliser dans les applications.",
        )
    if not valid or account is None:
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
    # Un même lien peut confirmer l'adresse d'origine ou une nouvelle : le
    # site n'a pas à savoir laquelle, il suit le lien reçu.
    row = db.scalars(
        select(EmailVerification).where(
            EmailVerification.token_hash == hash_refresh_token(payload.token)
        )
    ).one_or_none()
    purpose = row.purpose if row is not None else "verify"
    if purpose not in ("verify", "change"):
        purpose = "verify"

    row = consume_link(db, payload.token, purpose)
    account = db.get(Account, row.account_id)
    now = datetime.now(UTC)

    if account is not None:
        if row.purpose == "change" and row.new_email:
            taken = db.scalars(
                select(Account).where(
                    Account.email == row.new_email, Account.id != account.id
                )
            ).one_or_none()
            if taken is not None:
                # L'adresse a été prise entre la demande et la confirmation.
                raise HTTPException(
                    status.HTTP_409_CONFLICT, "Cette adresse est déjà utilisée."
                )
            account.email = row.new_email
        # Suivre le lien prouve la boîte : l'adresse est confirmée dans les
        # deux cas.
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
    _send_verification(db, account, payload.lang, strict=True)
    return {"sent": True}


@router.post("/google", response_model=TokenResponse)
def google_sign_in(payload: GoogleRequest, db: DbSession = Depends(get_db)) -> TokenResponse:
    """Crée le compte ou ouvre la session, à partir d'un jeton Google.

    Une seule route pour les deux : du point de vue de qui clique, « continuer
    avec Google » ne distingue pas l'inscription de la connexion, et lui
    demander lequel des deux il veut serait lui demander de se souvenir s'il
    est déjà venu.
    """
    settings = get_settings()
    try:
        identity = verify_id_token(payload.id_token, settings)
    except GoogleError as exc:
        # Le détail part dans les journaux, pas au client : il ne l'aiderait
        # pas, et il renseignerait qui cherche à forger un jeton.
        logger.info("Jeton Google refusé : %s", exc)
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Connexion Google refusée."
        ) from None

    account = db.scalars(
        select(Account).where(Account.google_sub == identity.sub)
    ).one_or_none()

    if account is None:
        # Même adresse, compte existant : on relie plutôt que de créer un
        # doublon. Google a vérifié l'adresse, c'est bien la même personne.
        account = db.scalars(
            select(Account).where(Account.email == identity.email)
        ).one_or_none()
        if account is not None:
            account.google_sub = identity.sub
            if account.email_verified_at is None:
                account.email_verified_at = datetime.now(UTC)
            db.commit()

    if account is None:
        stored_code = _check_registration(db, payload.invite_code)
        account = Account(
            email=identity.email,
            # Pas de mot de passe : ce compte se connecte avec Google, et il
            # pourra en poser un depuis la page du compte pour les
            # applications.
            password_hash="",
            google_sub=identity.sub,
            # L'adresse vient d'être vérifiée par Google : redemander une
            # confirmation par courrier ne prouverait rien de plus.
            email_verified_at=datetime.now(UTC),
        )
        db.add(account)
        try:
            db.flush()
            if stored_code is not None:
                code_rules.redeem(db, account, stored_code)
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Cette adresse est déjà inscrite"
            ) from None

    _enforce_device_limit(db, account)
    return _issue_tokens(db, account, payload.device_label or "Google")


@router.post("/password/forgot", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(
    payload: ForgotPasswordRequest, db: DbSession = Depends(get_db)
) -> dict[str, bool]:
    """Envoie un lien de réinitialisation, si le compte existe.

    La réponse est la même dans tous les cas : dire « adresse inconnue »
    transformerait cette route en annuaire des comptes du service.
    """
    account = db.scalars(
        select(Account).where(Account.email == payload.email.lower())
    ).one_or_none()

    if account is not None:
        token = new_link(db, account, "reset")
        try:
            send_password_reset_email(get_settings(), account.email, token, payload.lang)
        except MailError:
            # La réponse reste la même : signaler l'échec ici dirait que
            # l'adresse existe, ce que toute cette route s'applique à taire.
            logger.error("Lien de réinitialisation non envoyé")

    return {"sent": True}


@router.post("/password/reset", response_model=TokenResponse)
def reset_password(payload: ResetPasswordRequest, db: DbSession = Depends(get_db)) -> TokenResponse:
    """Repose un mot de passe et déconnecte tous les appareils.

    Une réinitialisation sert aussi à reprendre un compte dont on a perdu le
    contrôle : laisser les sessions ouvertes laisserait la porte ouverte à
    celui qu'on cherche à mettre dehors.

    Le carnet n'est pas touché : il est chiffré avec la clef maîtresse, que le
    service ne connaît pas. Changer le mot de passe du compte ne le rend ni
    lisible, ni illisible.
    """
    row = consume_link(db, payload.token, "reset")
    account = db.get(Account, row.account_id)
    if account is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lien invalide ou expiré.")

    account.password_hash = hash_password(payload.password)
    db.query(Session).filter(
        Session.account_id == account.id, Session.revoked.is_(False)
    ).update({"revoked": True})
    db.commit()

    return _issue_tokens(db, account, "site web")
