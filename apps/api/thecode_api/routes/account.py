"""Gestion du compte : appareils connectés et codes.

Le site est le seul endroit où l'on gère son compte. Les applications et les
extensions se contentent de se connecter et de synchroniser : dupliquer ces
écrans partout multiplierait les endroits où une erreur de droits peut se
glisser, pour un geste qu'on ne fait que rarement.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from .. import codes as code_rules
from ..auth import current_account, current_session_id, hash_password, verify_password
from ..config import get_settings
from ..db import get_db
from ..links import new_link
from ..mailer import MailError, send_email_change_email
from ..models import (
    Account,
    Code,
    CodeRedemption,
    EmailVerification,
    Session,
    VaultEntry,
)
from ..schemas import (
    ChangeEmailRequest,
    ChangePasswordRequest,
    CodeRequest,
    CodeResponse,
    DeleteAccountRequest,
    DeviceResponse,
    b64encode,
)
from . import billing

router = APIRouter(prefix="/v1/account", tags=["account"])
logger = logging.getLogger("thecode.account")


@router.get("/devices", response_model=list[DeviceResponse])
def devices(
    account: Account = Depends(current_account), db: DbSession = Depends(get_db)
) -> list[DeviceResponse]:
    """Les appareils connectés, du plus récent au plus ancien.

    Nécessaire dès qu'il y a un plafond : sans cette liste, un utilisateur qui
    atteint la limite n'aurait aucun moyen de faire de la place.
    """
    rows = db.scalars(
        select(Session)
        .where(Session.account_id == account.id, Session.revoked.is_(False))
        .order_by(Session.created_at.desc())
    ).all()

    return [
        DeviceResponse(
            id=row.id,
            label=row.label or "appareil sans nom",
            created_at=row.created_at,
            expires_at=row.expires_at,
        )
        for row in rows
    ]


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_device(
    device_id: uuid.UUID,
    account: Account = Depends(current_account),
    db: DbSession = Depends(get_db),
) -> None:
    row = db.get(Session, device_id)
    # Le compte est vérifié avant tout : sans cela, connaître un identifiant
    # suffirait à déconnecter l'appareil de quelqu'un d'autre.
    if row is None or row.account_id != account.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appareil introuvable")

    row.revoked = True
    db.commit()


@router.post("/code", response_model=CodeResponse)
def use_code(
    payload: CodeRequest,
    account: Account = Depends(current_account),
    db: DbSession = Depends(get_db),
) -> CodeResponse:
    """Applique un code de parrainage ou un code à vie à un compte existant.

    Le même code qu'à l'inscription : quelqu'un qui reçoit son code après avoir
    créé son compte ne doit pas avoir à en recréer un.
    """
    code = code_rules.find_usable(db, payload.code)
    if code is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Code inconnu, expiré ou déjà épuisé.")
    if code_rules.already_redeemed(db, account, code):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ce code a déjà été utilisé sur ce compte.")

    message = code_rules.redeem(db, account, code)
    db.commit()
    return CodeResponse(kind=code.kind, message=message)


@router.post("/password", status_code=status.HTTP_200_OK)
def change_password(
    payload: ChangePasswordRequest,
    account: Account = Depends(current_account),
    session_id: uuid.UUID | None = Depends(current_session_id),
    db: DbSession = Depends(get_db),
) -> dict[str, bool]:
    """Change le mot de passe du compte et déconnecte les autres appareils.

    Le mot de passe actuel est exigé : un compte laissé ouvert sur un écran
    non verrouillé ne doit pas suffire à en verrouiller le propriétaire dehors.
    Un compte créé par Google n'en a pas encore — il en pose un ici, et c'est
    ce qui lui ouvre les applications, qui ne savent se connecter qu'ainsi.

    Le carnet n'est pas touché : il est chiffré avec la clef maîtresse, que le
    service ne connaît pas. Ce mot de passe-ci ne garde que la
    synchronisation.
    """
    if account.password_hash and not verify_password(payload.current_password, account.password_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Mot de passe actuel incorrect.")

    account.password_hash = hash_password(payload.new_password)

    # Les autres appareils, pas celui-ci : déconnecter aussi celui qui vient de
    # changer son mot de passe serait une punition pour avoir bien fait.
    others = db.query(Session).filter(
        Session.account_id == account.id, Session.revoked.is_(False)
    )
    if session_id is not None:
        others = others.filter(Session.id != session_id)
    others.update({"revoked": True}, synchronize_session=False)

    db.commit()
    return {"changed": True}


@router.post("/email", status_code=status.HTTP_202_ACCEPTED)
def change_email(
    payload: ChangeEmailRequest,
    account: Account = Depends(current_account),
    db: DbSession = Depends(get_db),
) -> dict[str, bool]:
    """Demande un changement d'adresse, confirmé par la nouvelle boîte.

    Rien ne change tant que le lien n'est pas suivi : l'adresse du compte
    reste celle qui marche, et une demande abandonnée ne laisse rien derrière
    elle. Le lien part vers la nouvelle adresse, jamais vers l'ancienne — c'est
    la nouvelle qu'il s'agit de prouver.
    """
    new_email = payload.new_email.lower()
    if new_email == account.email:
        raise HTTPException(status.HTTP_409_CONFLICT, "C'est déjà votre adresse.")

    if account.password_hash and not verify_password(payload.password, account.password_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Mot de passe incorrect.")

    # Contrôle indicatif : l'adresse peut être prise entre-temps, et la
    # confirmation refait le test. Le faire ici évite d'envoyer un courrier
    # dont on sait déjà qu'il ne mènera nulle part.
    taken = db.scalars(select(Account).where(Account.email == new_email)).one_or_none()
    if taken is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Cette adresse est déjà utilisée.")

    token = new_link(db, account, "change", new_email=new_email)
    try:
        send_email_change_email(get_settings(), new_email, token, payload.lang)
    except MailError:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "L'envoi du courrier a échoué. Votre adresse actuelle reste en place ; "
            "réessayez dans un moment.",
        ) from None
    return {"sent": True}


@router.get("/export")
def export_account(
    account: Account = Depends(current_account), db: DbSession = Depends(get_db)
) -> dict[str, object]:
    """Rend tout ce que le service garde de ce compte.

    Tout, y compris les entrées du carnet — elles appartiennent à
    l'utilisateur. Elles sortent telles qu'elles sont stockées, c'est-à-dire
    chiffrées : le service n'a jamais eu la clef et ne peut pas les rendre
    autrement. Sans la clef maîtresse, ce fichier ne dit rien de plus au
    service qu'à n'importe qui d'autre.
    """
    entries = db.scalars(
        select(VaultEntry).where(VaultEntry.account_id == account.id).order_by(VaultEntry.revision)
    ).all()
    sessions = db.scalars(select(Session).where(Session.account_id == account.id)).all()
    redemptions = db.scalars(
        select(Code.code, Code.kind, CodeRedemption.redeemed_at)
        .select_from(CodeRedemption)
        .join(Code, Code.id == CodeRedemption.code_id)
        .where(CodeRedemption.account_id == account.id)
    ).all()
    pending = db.scalars(
        select(EmailVerification).where(
            EmailVerification.account_id == account.id, EmailVerification.used_at.is_(None)
        )
    ).all()

    return {
        "note": (
            "Les entrées du carnet sont chiffrées sur l'appareil, avec une clef "
            "dérivée de votre clef maîtresse. Le service ne la connaît pas et ne "
            "peut donc pas les déchiffrer — vous seule le pouvez."
        ),
        "account": {
            "email": account.email,
            "created_at": account.created_at,
            "email_verified_at": account.email_verified_at,
            "plan": account.plan,
            "plan_source": account.plan_source,
            "subscription_status": account.subscription_status,
            "current_period_end": account.current_period_end,
            "google_linked": bool(account.google_sub),
            # L'identifiant client Stripe fait partie des données du compte :
            # c'est lui qui relie cette personne à ses factures.
            "stripe_customer_id": account.stripe_customer_id,
            "revision": account.revision,
        },
        "devices": [
            {
                "label": row.label,
                "created_at": row.created_at,
                "expires_at": row.expires_at,
                "revoked": row.revoked,
            }
            for row in sessions
        ],
        "codes_used": [
            {"code": code, "kind": kind, "redeemed_at": redeemed_at}
            for code, kind, redeemed_at in redemptions
        ],
        "pending_links": [
            {"purpose": row.purpose, "new_email": row.new_email, "expires_at": row.expires_at}
            for row in pending
        ],
        "vault": [
            {
                "entry_id": row.entry_id,
                "nonce": b64encode(row.nonce),
                "blob": b64encode(row.blob),
                "deleted": row.deleted,
                "revision": row.revision,
                "updated_at": row.updated_at,
            }
            for row in entries
        ],
    }


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    payload: DeleteAccountRequest,
    account: Account = Depends(current_account),
    db: DbSession = Depends(get_db),
) -> None:
    """Efface le compte, le carnet et les sessions.

    Vraiment effacé, pas marqué comme tel : c'est ce qu'on attend d'une
    suppression, et garder « au cas où » des adresses et des carnets de gens
    partis est précisément ce qu'on reproche aux autres.

    L'abonnement est résilié **avant** la suppression. Dans l'autre ordre, une
    panne de Stripe laisserait un prélèvement mensuel sur un compte qui
    n'existe plus, et plus personne pour le voir.
    """
    if account.email != payload.confirm_email.lower():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "L'adresse saisie ne correspond pas à celle du compte.",
        )
    if account.password_hash and not verify_password(payload.password, account.password_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Mot de passe incorrect.")

    if account.stripe_subscription_id:
        settings = get_settings()
        try:
            billing.cancel_subscription(settings, account.stripe_subscription_id)
        except Exception as exc:  # noqa: BLE001 - la cause exacte vient de Stripe
            logger.error("Résiliation Stripe impossible : %s", exc)
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "L'abonnement n'a pas pu être résilié : le compte n'a pas été "
                "supprimé, pour ne pas vous laisser un prélèvement sans compte. "
                "Réessayez dans un moment.",
            ) from None

    # Les entrées, les sessions, les liens et les codes consommés partent avec
    # le compte : les clefs étrangères sont en ON DELETE CASCADE.
    db.delete(account)
    db.commit()


@router.delete("/google", status_code=status.HTTP_204_NO_CONTENT)
def unlink_google(
    account: Account = Depends(current_account), db: DbSession = Depends(get_db)
) -> None:
    """Détache le compte Google, pour ne plus passer par lui.

    Refusé tant qu'aucun mot de passe n'est défini : ce serait couper la seule
    porte d'entrée du compte, et personne — pas même nous — ne pourrait la
    rouvrir. Le message le dit et indique quoi faire avant.

    Le carnet n'est pas concerné : il est chiffré avec la clef maîtresse, que
    le service ne connaît pas. Changer la façon d'ouvrir le compte ne change
    rien à ce qu'il contient.
    """
    if not account.google_sub:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Aucun compte Google n'est lié à ce compte."
        )
    if not account.password_hash:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Définissez d'abord un mot de passe : sans lui, délier Google "
            "fermerait la seule porte d'entrée de ce compte.",
        )

    account.google_sub = ""
    db.commit()
