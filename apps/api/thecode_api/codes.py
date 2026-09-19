"""Codes d'invitation, de parrainage et à vie.

Un seul point d'entrée pour les valider et les consommer : ces codes sont
saisis à deux endroits (à l'inscription et depuis la page du compte), et deux
implémentations d'une même règle finiraient par ne plus dire la même chose.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from .models import Account, Code, CodeRedemption
from .plans import PRO

INVITE = "invite"
REFERRAL = "referral"
LIFETIME = "lifetime"
KINDS = (INVITE, REFERRAL, LIFETIME)


def normalize(raw: str) -> str:
    """Majuscules et sans espaces : un code se recopie à la main."""
    return raw.strip().replace(" ", "").upper()


def find_usable(db: DbSession, raw: str) -> Code | None:
    """Rend le code s'il existe, est actif, non expiré et non épuisé."""
    value = normalize(raw)
    if not value:
        return None

    code = db.scalars(select(Code).where(Code.code == value)).one_or_none()
    if code is None or not code.active:
        return None
    if code.expires_at is not None and _as_utc(code.expires_at) <= datetime.now(UTC):
        return None
    if code.max_uses and code.used_count >= code.max_uses:
        return None
    return code


def already_redeemed(db: DbSession, account: Account, code: Code) -> bool:
    return (
        db.scalars(
            select(CodeRedemption).where(
                CodeRedemption.account_id == account.id, CodeRedemption.code_id == code.id
            )
        ).one_or_none()
        is not None
    )


def redeem(db: DbSession, account: Account, code: Code) -> str:
    """Applique l'effet du code au compte et l'enregistre comme consommé.

    Ne valide rien : `find_usable` l'a déjà fait. Ne committe pas : l'appelant
    sait si le compte qu'il vient de créer doit être écrit en même temps.

    Rend une phrase destinée à l'utilisateur, parce que « code accepté » ne dit
    pas si on vient de gagner une remise ou l'offre à vie.
    """
    if code.kind == LIFETIME:
        account.plan = PRO
        # Statut à part : ce compte n'a pas d'abonnement Stripe, et un
        # `active` le rendrait indiscernable d'un abonnement payant que Stripe
        # pourrait un jour annuler.
        account.subscription_status = "lifetime"
        account.plan_source = "lifetime"
        account.stripe_subscription_id = ""
        account.current_period_end = None
        message = "Offre complète activée à vie."
    elif code.kind == REFERRAL:
        account.pending_coupon = code.stripe_coupon_id
        message = "Remise de parrainage enregistrée : elle s'appliquera à l'abonnement."
    else:
        message = "Code d'invitation accepté."

    code.used_count += 1
    db.add(CodeRedemption(account_id=account.id, code_id=code.id))
    return message


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)
