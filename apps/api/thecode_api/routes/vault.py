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
from ..models import Account, DefaultSettings, VaultEntry
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
        max_entries=limits_for(account, get_settings()).max_entries,
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
    # Compté après l'écriture : une suppression poussée dans le même lot
    # qu'un ajout libère sa place. Et seule une croissance est refusée — un
    # compte déjà au-delà du plafond, après une fin d'abonnement, doit pouvoir
    # continuer à modifier et supprimer ce qu'il a.
    final = {entry_id: not row.deleted for entry_id, row in existing.items()}
    final.update({e.entry_id: not e.deleted for e in payload.entries})
    live_before = sum(not row.deleted for row in existing.values())
    live_after = sum(final.values())
    if live_after > live_before and live_after > limits.max_entries:
        # 402 et non 403 quand c'est l'offre qui borne : le client doit
        # pouvoir distinguer « vous n'avez pas le droit » de « il faut
        # s'abonner », et proposer la bonne suite.
        if limits.plan == "free":
            site = settings.site_url.rstrip("/")
            # Deux suites possibles selon qu'on peut payer ou non : envoyer
            # quelqu'un s'abonner à un abonnement qui n'existe pas encore
            # serait une impasse.
            suite = (
                f"Pour tout synchroniser, passez à l'offre complète sur {site}."
                if settings.billing_enabled
                else f"Pour lever la limite, utilisez un code de déblocage sur {site}."
            )
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                f"Offre gratuite : {limits.max_entries} entrées synchronisées au "
                f"maximum. Les autres restent sur cet appareil. {suite}",
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
    """Efface toutes les entrées du compte, et ses réglages par défaut.

    Les réglages voyagent avec le carnet : vider l'un en laissant l'autre
    garderait sur le serveur une trace de ce que l'utilisateur a voulu effacer.

    Suppression réelle, pas une pierre tombale : c'est une action explicite de
    l'utilisateur sur son propre compte, pas une synchronisation.
    """
    db.query(VaultEntry).filter(VaultEntry.account_id == account.id).delete()
    db.query(DefaultSettings).filter(DefaultSettings.account_id == account.id).delete()
    account.revision += 1
    db.commit()
