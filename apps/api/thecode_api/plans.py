"""Offres et plafonds.

Ce que l'abonnement achète, c'est de la synchronisation : la génération de mots
de passe, elle, ne passe par aucun serveur et reste gratuite pour tout le monde
— il n'y a rien à facturer sur un calcul qui se fait sur l'appareil.

Les plafonds vivent ici et nulle part ailleurs : une limite écrite deux fois
finit par diverger, et une divergence entre ce que le site annonce et ce que le
serveur refuse est la pire des façons de l'apprendre.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session as DbSession

from .config import Settings
from .models import Account, Session, VaultEntry

FREE = "free"
PRO = "pro"

#: Statuts Stripe qui donnent encore droit à l'offre payante.
#:
#: `past_due` en fait partie : Stripe relance le paiement pendant plusieurs
#: jours, et couper la synchronisation d'une carte expirée avant même la
#: première relance ferait perdre des données à quelqu'un qui paie.
ACTIVE_STATUSES = ("active", "trialing", "past_due", "lifetime")


@dataclass(frozen=True)
class Limits:
    plan: str
    max_entries: int
    max_devices: int


def is_pro(account: Account) -> bool:
    return account.plan == PRO and account.subscription_status in ACTIVE_STATUSES


def _full(settings: Settings) -> Limits:
    return Limits(
        plan=PRO,
        max_entries=settings.max_entries_per_account,
        max_devices=settings.pro_max_devices,
    )


def limits_for(account: Account, settings: Settings) -> Limits:
    """Ce à quoi ce compte a droit.

    Tant que les offres ne s'appliquent pas, tout le monde a tout : rien n'est
    vendu, donc rien n'est retenu. Les clients lisent l'offre rendue ici pour
    décider ce qu'ils proposent — ils obtiennent donc `pro`, et le compteur
    fonctionne pour tout le monde, sans qu'aucun d'eux ait à connaître la
    raison.
    """
    if not settings.plans_enabled:
        return _full(settings)
    if is_pro(account):
        return _full(settings)
    return Limits(
        plan=FREE,
        max_entries=min(settings.free_max_entries, settings.max_entries_per_account),
        max_devices=settings.free_max_devices,
    )


def live_entry_count(db: DbSession, account: Account) -> int:
    """Entrées réellement présentes : les pierres tombales ne comptent pas."""
    return (
        db.scalar(
            select(func.count())
            .select_from(VaultEntry)
            .where(VaultEntry.account_id == account.id, VaultEntry.deleted.is_(False))
        )
        or 0
    )


def active_device_count(db: DbSession, account: Account) -> int:
    """Appareils connectés : une session vivante, c'est un appareil.

    Une session révoquée ou expirée ne compte pas, sinon se déconnecter ne
    libèrerait jamais de place et le plafond finirait par tout bloquer.
    """
    return (
        db.scalar(
            select(func.count())
            .select_from(Session)
            .where(
                Session.account_id == account.id,
                Session.revoked.is_(False),
                Session.expires_at > datetime.now(UTC),
            )
        )
        or 0
    )
