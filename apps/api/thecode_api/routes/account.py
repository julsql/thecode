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
from ..auth import current_account
from ..db import get_db
from ..models import Account, Session
from ..schemas import CodeRequest, CodeResponse, DeviceResponse

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
