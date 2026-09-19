"""Synchronisation du carnet.

Le serveur ne résout aucun conflit : il ne le peut pas, tout est chiffré. Il
stocke, horodate, et rend le delta. La fusion se fait sur l'appareil, selon
shared/spec/vault-merge.md.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from ..auth import current_account
from ..config import get_settings
from ..db import get_db
from ..models import Account, VaultEntry
from ..plans import limits_for
from ..schemas import (
    EntryResponse,
    PullResponse,
    PushRequest,
    PushResponse,
    b64decode,
    b64encode,
)

router = APIRouter(prefix="/v1/vault", tags=["vault"])


@router.get("", response_model=PullResponse)
def pull(
    since: int = Query(0, ge=0, description="Dernière révision connue du client"),
    account: Account = Depends(current_account),
    db: DbSession = Depends(get_db),
) -> PullResponse:
    """Rend les entrées modifiées depuis `since`.

    Le delta évite de retélécharger tout le carnet à chaque synchronisation,
    et de faire grossir la facture réseau d'un téléphone.
    """
    rows = db.scalars(
        select(VaultEntry)
        .where(VaultEntry.account_id == account.id, VaultEntry.revision > since)
        .order_by(VaultEntry.revision)
    ).all()

    return PullResponse(
        revision=account.revision,
        entries=[
            EntryResponse(
                entry_id=row.entry_id,
                nonce=b64encode(row.nonce),
                blob=b64encode(row.blob),
                deleted=row.deleted,
                revision=row.revision,
            )
            for row in rows
        ],
    )


@router.post("", response_model=PushResponse)
def push(
    payload: PushRequest,
    account: Account = Depends(current_account),
    db: DbSession = Depends(get_db),
) -> PushResponse:
    """Écrit un lot d'entrées chiffrées.

    Concurrence optimiste : si la révision du serveur a dépassé celle sur
    laquelle le client a travaillé, on refuse. Écraser reviendrait à perdre ce
    qu'un autre appareil a écrit entre-temps, en silence.
    """
    settings = get_settings()

    if payload.base_revision != account.revision:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Le carnet a changé depuis (révision {account.revision}, "
            f"vous écrivez sur {payload.base_revision}). Refaites un pull puis fusionnez.",
        )

    for entry in payload.entries:
        if len(b64decode(entry.blob)) > settings.max_blob_bytes:
            raise HTTPException(
                status.HTTP_413_CONTENT_TOO_LARGE,
                f"Entrée {entry.entry_id} trop volumineuse : le carnet stocke des "
                "métadonnées, pas des fichiers.",
            )

    existing = {
        row.entry_id: row
        for row in db.scalars(
            select(VaultEntry).where(VaultEntry.account_id == account.id)
        ).all()
    }

    limits = limits_for(account, settings)
    incoming_new = [e for e in payload.entries if e.entry_id not in existing and not e.deleted]
    live = len([r for r in existing.values() if not r.deleted])
    if live + len(incoming_new) > limits.max_entries:
        # 402 et non 403 quand c'est l'offre qui borne : le client doit
        # pouvoir distinguer « vous n'avez pas le droit » de « il faut
        # s'abonner », et proposer la bonne suite.
        if limits.plan == "free":
            site = settings.site_url.rstrip("/")
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                f"Offre gratuite : {limits.max_entries} entrées synchronisées au "
                f"maximum. Les autres restent sur cet appareil. "
                f"Pour tout synchroniser, passez à l'offre complète sur {site}.",
            )
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Limite de {limits.max_entries} entrées atteinte.",
        )

    account.revision += 1
    revision = account.revision

    for entry in payload.entries:
        row = existing.get(entry.entry_id)
        if row is None:
            row = VaultEntry(account_id=account.id, entry_id=entry.entry_id)
            db.add(row)
        row.nonce = b64decode(entry.nonce)
        row.blob = b64decode(entry.blob)
        # La suppression reste en base : une pierre tombale doit se propager
        # aux autres appareils, sinon elle serait annulée à la fusion suivante.
        row.deleted = entry.deleted
        row.revision = revision

    db.commit()
    return PushResponse(revision=revision, accepted=len(payload.entries))


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def purge(
    account: Account = Depends(current_account),
    db: DbSession = Depends(get_db),
) -> None:
    """Efface toutes les entrées du compte.

    Suppression réelle, pas une pierre tombale : c'est une action explicite de
    l'utilisateur sur son propre compte, pas une synchronisation.
    """
    db.query(VaultEntry).filter(VaultEntry.account_id == account.id).delete()
    account.revision += 1
    db.commit()
