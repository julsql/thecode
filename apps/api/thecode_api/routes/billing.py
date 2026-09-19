"""Abonnement : tarifs, paiement, portail client, webhook.

Stripe tient les moyens de paiement, les factures et les relances. Le service
ne stocke ni carte ni adresse : il garde l'identifiant du client Stripe, celui
de l'abonnement, et le statut qui en découle. C'est le minimum pour savoir qui
a droit à quoi, et rien de plus n'a de raison d'être ici.

La source de vérité est le webhook, jamais le retour de navigateur : quelqu'un
qui ferme l'onglet juste après avoir payé doit quand même être abonné, et
quelqu'un qui recopie l'URL de succès ne doit rien obtenir.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from ..auth import current_account
from ..config import Settings, get_settings
from ..db import get_db
from ..models import Account
from ..plans import ACTIVE_STATUSES, FREE, PRO
from ..schemas import CheckoutRequest, CheckoutResponse, PlansResponse

router = APIRouter(prefix="/v1/billing", tags=["billing"])
logger = logging.getLogger("thecode.billing")


def _stripe(settings: Settings):
    if not settings.plans_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Toutes les fonctions sont ouvertes gratuitement : il n'y a rien à "
            "souscrire pour le moment.",
        )
    if not settings.billing_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "L'abonnement n'est pas disponible pour le moment.",
        )
    stripe.api_key = settings.stripe_secret_key
    return stripe


def _safe_return_path(raw: str) -> str:
    """N'accepte qu'un chemin interne au site.

    Stripe renvoie le navigateur à l'URL qu'on lui donne. Accepter une URL
    complète ferait du service un tremplin : un lien de paiement forgé
    ramènerait sur un site qui imite le nôtre, juste après une saisie de carte.
    """
    path = raw.strip() or "/en/account"
    if not path.startswith("/") or path.startswith("//") or "\\" in path or "://" in path:
        return "/en/account"
    return path


@router.get("/plans", response_model=PlansResponse)
def plans() -> PlansResponse:
    """Les tarifs, lisibles sans compte : c'est une page publique."""
    settings = get_settings()
    return PlansResponse(
        plans_enforced=settings.plans_enabled,
        price_monthly_cents=settings.price_monthly_cents,
        currency=settings.price_currency,
        billing_available=settings.billing_enabled,
        free_max_entries=settings.free_max_entries,
        free_max_devices=settings.free_max_devices,
        pro_max_entries=settings.max_entries_per_account,
        pro_max_devices=settings.pro_max_devices,
    )


@router.post("/checkout", response_model=CheckoutResponse)
def checkout(
    payload: CheckoutRequest,
    account: Account = Depends(current_account),
    db: DbSession = Depends(get_db),
) -> CheckoutResponse:
    settings = get_settings()
    client = _stripe(settings)

    if account.plan == PRO and account.subscription_status in ACTIVE_STATUSES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ce compte a déjà l'offre complète. Le changement d'offre se fait "
            "depuis la gestion de l'abonnement.",
        )

    if not account.stripe_customer_id:
        customer = client.Customer.create(
            email=account.email, metadata={"account_id": str(account.id)}
        )
        account.stripe_customer_id = customer["id"]
        db.commit()

    site = settings.site_url.rstrip("/")
    path = _safe_return_path(payload.return_path)
    separator = "&" if "?" in path else "?"

    params: dict[str, object] = {
        "mode": "subscription",
        "customer": account.stripe_customer_id,
        "line_items": [{"price": settings.stripe_price_id, "quantity": 1}],
        "success_url": f"{site}{path}{separator}checkout=success",
        "cancel_url": f"{site}{path}{separator}checkout=cancel",
        "client_reference_id": str(account.id),
        # Le compte est aussi porté par l'abonnement : les événements de
        # renouvellement parlent de l'abonnement, pas de la session de paiement.
        "subscription_data": {"metadata": {"account_id": str(account.id)}},
    }

    # Une remise explicite et le champ « code promo » de Stripe s'excluent :
    # Stripe refuse les deux ensemble.
    if payload.promo_code:
        found = client.PromotionCode.list(code=payload.promo_code.strip(), active=True, limit=1)
        data = found.get("data") or []
        if not data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Code promotionnel inconnu ou expiré.")
        params["discounts"] = [{"promotion_code": data[0]["id"]}]
    elif account.pending_coupon:
        # Remise de parrainage enregistrée à l'inscription : elle s'applique
        # ici, au premier abonnement.
        params["discounts"] = [{"coupon": account.pending_coupon}]
    else:
        params["allow_promotion_codes"] = True

    session = client.checkout.Session.create(**params)
    return CheckoutResponse(url=session["url"])


@router.post("/portal", response_model=CheckoutResponse)
def portal(
    payload: CheckoutRequest,
    account: Account = Depends(current_account),
) -> CheckoutResponse:
    """Ouvre le portail Stripe : changement d'offre, moyen de paiement, arrêt.

    Tout se passe chez Stripe plutôt que chez nous : les écrans de facturation
    sont un métier à part entière, et les refaire à moitié reviendrait à
    fabriquer des angles morts sur des questions d'argent.
    """
    settings = get_settings()
    client = _stripe(settings)

    if not account.stripe_customer_id:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Aucun abonnement à gérer sur ce compte.",
        )

    site = settings.site_url.rstrip("/")
    session = client.billing_portal.Session.create(
        customer=account.stripe_customer_id,
        return_url=f"{site}{_safe_return_path(payload.return_path)}",
    )
    return CheckoutResponse(url=session["url"])


@router.post("/webhook", include_in_schema=False)
async def webhook(
    request: Request,
    stripe_signature: str = Header(default="", alias="Stripe-Signature"),
    db: DbSession = Depends(get_db),
) -> dict[str, bool]:
    settings = get_settings()
    client = _stripe(settings)

    raw = await request.body()
    try:
        event = client.Webhook.construct_event(
            raw, stripe_signature, settings.stripe_webhook_secret
        )
    except (stripe.SignatureVerificationError, ValueError):
        # Sans signature valable, n'importe qui s'offrirait un abonnement en
        # appelant cette URL. Le détail de l'erreur ne regarde pas l'appelant.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Signature invalide") from None

    kind = event["type"]
    obj = event["data"]["object"]

    if kind == "checkout.session.completed":
        account = _account_for(db, obj.get("client_reference_id"), obj.get("customer"))
        if account is not None:
            account.stripe_customer_id = obj.get("customer") or account.stripe_customer_id
            account.stripe_subscription_id = obj.get("subscription") or ""
            account.plan = PRO
            account.subscription_status = "active"
            account.plan_source = "stripe"
            # La remise a servi : la garder la ferait rejouer au prochain
            # abonnement, des mois plus tard, sans que personne ne comprenne.
            account.pending_coupon = ""
            db.commit()

    elif kind in ("customer.subscription.created", "customer.subscription.updated"):
        metadata = obj.get("metadata") or {}
        account = _account_for(db, metadata.get("account_id"), obj.get("customer"))
        if account is not None and account.plan_source != "lifetime":
            status_value = obj.get("status") or "active"
            account.stripe_subscription_id = obj.get("id") or account.stripe_subscription_id
            account.subscription_status = status_value
            account.plan = PRO if status_value in ACTIVE_STATUSES else FREE
            account.plan_source = "stripe" if status_value in ACTIVE_STATUSES else "none"
            account.current_period_end = _as_datetime(obj.get("current_period_end"))
            db.commit()

    elif kind == "customer.subscription.deleted":
        metadata = obj.get("metadata") or {}
        account = _account_for(db, metadata.get("account_id"), obj.get("customer"))
        # Un compte à vie ne se rétrograde pas : il n'a jamais eu d'abonnement
        # Stripe, et un événement qui le concerne par erreur ne doit pas lui
        # retirer ce qui lui a été donné.
        if account is not None and account.plan_source != "lifetime":
            account.plan = FREE
            account.subscription_status = "canceled"
            account.plan_source = "none"
            account.stripe_subscription_id = ""
            db.commit()

    else:
        logger.info("Événement Stripe ignoré : %s", kind)

    return {"received": True}


def _account_for(db: DbSession, account_id: str | None, customer_id: str | None) -> Account | None:
    """Retrouve le compte, par identifiant puis par client Stripe.

    Les deux chemins existent parce que les événements ne portent pas tous les
    mêmes champs, et qu'un abonnement renouvelé des mois plus tard ne parle
    plus de la session de paiement d'origine.
    """
    if account_id:
        # L'identifiant vient de Stripe, donc d'un champ que nous avons nous-mêmes
        # rempli — mais il revient de l'extérieur, et une chaîne qui n'est pas un
        # UUID ferait échouer la requête au lieu de simplement ne rien trouver.
        try:
            parsed = uuid.UUID(str(account_id))
        except ValueError:
            parsed = None
        if parsed is not None:
            account = db.get(Account, parsed)
            if account is not None:
                return account

    if customer_id:
        return db.scalars(
            select(Account).where(Account.stripe_customer_id == customer_id)
        ).one_or_none()

    return None


def _as_datetime(value: object) -> datetime | None:
    if isinstance(value, int):
        return datetime.fromtimestamp(value, UTC)
    return None


def cancel_subscription(settings: Settings, subscription_id: str) -> None:
    """Résilie immédiatement un abonnement.

    Immédiatement et non en fin de période : appelé depuis la suppression de
    compte, où il n'y a plus personne pour profiter de la fin du mois payé.

    Un abonnement déjà résilié n'est pas une erreur : Stripe le dit, et
    refuser la suppression pour cette raison bloquerait quelqu'un qui a
    simplement résilié avant de partir.
    """
    client = _stripe(settings)
    try:
        client.Subscription.cancel(subscription_id)
    except stripe.InvalidRequestError as exc:
        message = str(exc)
        if "No such subscription" in message or "canceled" in message:
            logger.info("Abonnement déjà résilié ou inconnu : %s", subscription_id)
            return
        raise
