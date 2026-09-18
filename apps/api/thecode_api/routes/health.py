"""Sondes de disponibilité."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Le processus répond. Volontairement sans accès à la base : cette sonde
    sert à savoir si le conteneur doit être redémarré, pas si la base est là."""
    return {"status": "ok"}


@router.get("/ready")
def ready(db: Session = Depends(get_db)) -> dict[str, str]:
    """Le service peut traiter une requête, base comprise."""
    db.execute(text("SELECT 1"))
    return {"status": "ready"}
