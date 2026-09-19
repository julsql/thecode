"""Gestion du compte : appareils connectés et codes.

Le site est le seul endroit où l'on gère son compte. Les applications et les
extensions se contentent de se connecter et de synchroniser : dupliquer ces
écrans partout multiplierait les endroits où une erreur de droits peut se
glisser, pour un geste qu'on ne fait que rarement.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from .. import codes as code_rules
from ..auth import current_account, current_session_id, hash_password, verify_password
from ..config import get_settings
from ..db import get_db
from ..links import new_link
from ..mailer import send_email_change_email
from ..models import Account, Session
from ..schemas import (
    ChangeEmailRequest,
    ChangePasswordRequest,
    CodeRequest,
    CodeResponse,
    DeviceResponse,
)

router = APIRouter(prefix="/v1/account", tags=["account"])


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
    send_email_change_email(get_settings(), new_email, token, payload.lang)
    return {"sent": True}
