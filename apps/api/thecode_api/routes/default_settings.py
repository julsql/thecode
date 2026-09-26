"""Réglages par défaut partagés par le compte.

Longueur et jeux de caractères pour un site absent du carnet, chiffrés sur
l'appareil comme une entrée. Le serveur garde un seul blob par compte et n'en
lit rien : c'est le client qui choisit, selon `updatedAt`, entre sa valeur et
celle-ci. Voir shared/spec/default-settings.md.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session as DbSession

from ..auth import current_account
from ..db import get_db
from ..models import Account, DefaultSettings
from ..schemas import DefaultSettingsPayload, b64decode, b64encode

router = APIRouter(prefix="/v1/settings", tags=["settings"])

#: Quelques dizaines d'octets suffisent aujourd'hui : la borne laisse de la
#: place pour de nouveaux réglages, pas pour en faire un stockage de fichiers.
MAX_SETTINGS_BYTES = 4 * 1024


@router.get(
    "",
    response_model=DefaultSettingsPayload,
    responses={status.HTTP_204_NO_CONTENT: {"description": "Aucun réglage enregistré"}},
)
def read(
    account: Account = Depends(current_account),
    db: DbSession = Depends(get_db),
) -> DefaultSettingsPayload | Response:
    """Rend les réglages chiffrés du compte, ou 204 s'il n'en a pas.

    204 et non 404 : un compte sans réglages n'a rien d'anormal, le client
    garde simplement les siens.
    """
    row = db.get(DefaultSettings, account.id)
    if row is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return DefaultSettingsPayload(nonce=b64encode(row.nonce), blob=b64encode(row.blob))


@router.put("", status_code=status.HTTP_204_NO_CONTENT)
def write(
    payload: DefaultSettingsPayload,
    account: Account = Depends(current_account),
    db: DbSession = Depends(get_db),
) -> None:
    """Remplace les réglages du compte.

    Pas de révision ni de refus en cas de concurrence : le client a déjà
    tranché selon `updatedAt`, que lui seul peut lire. Hors du plafond
    d'entrées de l'offre : ce n'est pas un mot de passe de plus.
    """
    blob = b64decode(payload.blob)
    if len(blob) > MAX_SETTINGS_BYTES:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            f"Réglages trop volumineux : {MAX_SETTINGS_BYTES} octets au maximum.",
        )

    row = db.get(DefaultSettings, account.id)
    if row is None:
        row = DefaultSettings(account_id=account.id)
        db.add(row)
    row.nonce = b64decode(payload.nonce)
    row.blob = blob
    db.commit()
