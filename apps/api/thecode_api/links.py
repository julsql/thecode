"""Liens à usage unique envoyés par courrier.

Confirmer une adresse, confirmer un changement d'adresse, reprendre la main sur
un compte : trois usages, un seul mécanisme. Le regrouper ici évite que
l'expiration ou la consommation d'un lien soient traitées différemment selon la
porte par laquelle on arrive — la différence ne se verrait que le jour où elle
laisserait passer quelque chose.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from .auth import _as_utc, hash_refresh_token, new_refresh_token
from .config import get_settings
from .models import Account, EmailVerification


def new_link(db: DbSession, account: Account, purpose: str, new_email: str = "") -> str:
    """Crée un lien à usage unique et rend son jeton.

    Les liens précédents du même usage encore valables sont invalidés : deux
    liens vivants pour la même chose, c'est une porte de plus sans aucun
    bénéfice. Les autres usages sont laissés en place — une demande de
    changement d'adresse n'a pas à annuler une réinitialisation en cours.
    """
    settings = get_settings()
    db.query(EmailVerification).filter(
        EmailVerification.account_id == account.id,
        EmailVerification.purpose == purpose,
        EmailVerification.used_at.is_(None),
    ).delete()

    hours = settings.password_reset_hours if purpose == "reset" else (
        settings.email_verification_hours
    )
    token, token_hash = new_refresh_token()
    db.add(
        EmailVerification(
            account_id=account.id,
            token_hash=token_hash,
            purpose=purpose,
            new_email=new_email,
            expires_at=datetime.now(UTC) + timedelta(hours=hours),
        )
    )
    db.commit()
    return token


def consume_link(db: DbSession, token: str, purpose: str) -> EmailVerification:
    """Retrouve un lien valable et le marque consommé.

    Le même contrôle pour les trois usages : un lien rejouable resterait
    utilisable indéfiniment par qui l'a intercepté.
    """
    row = db.scalars(
        select(EmailVerification).where(
            EmailVerification.token_hash == hash_refresh_token(token)
        )
    ).one_or_none()

    now = datetime.now(UTC)
    if (
        row is None
        or row.purpose != purpose
        or row.used_at is not None
        or _as_utc(row.expires_at) <= now
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Lien invalide ou expiré. Demandez-en un nouveau.",
        )

    row.used_at = now
    return row
