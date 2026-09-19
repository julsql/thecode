"""Abonnement : tarifs, paiement, portail, webhook.

Stripe n'est jamais appelé ici. Ce qui est testé, c'est ce que le service lui
demande et ce qu'il fait de ses réponses — c'est là que sont les erreurs qui
coûtent de l'argent ou qui donnent un abonnement à quelqu'un qui n'a rien payé.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
import stripe

import thecode_api.routes.billing as billing_routes
from thecode_api.models import Account

PASSWORD = "mot-de-passe-de-test"


@pytest.fixture
def fake_stripe(monkeypatch):
    """Un Stripe en carton qui note ce qu'on lui demande."""
    calls: dict[str, list] = {
        "customers": [],
        "checkout": [],
        "portal": [],
        "promos": [],
        "cancelled": [],
    }
    events: dict[str, object] = {}

    def create_customer(**kwargs):
        calls["customers"].append(kwargs)
        return {"id": "cus_test"}

    def create_checkout(**kwargs):
        calls["checkout"].append(kwargs)
        return {"url": "https://stripe.test/checkout"}

    def create_portal(**kwargs):
        calls["portal"].append(kwargs)
        return {"url": "https://stripe.test/portal"}

    def cancel_subscription(subscription_id, **kwargs):
        calls["cancelled"].append(subscription_id)
        if subscription_id == "sub_en_panne":
            raise RuntimeError("Stripe injoignable")
        return {"id": subscription_id, "status": "canceled"}

    def list_promos(**kwargs):
        calls["promos"].append(kwargs)
        found = kwargs.get("code") == "REMISE20"
        return {"data": [{"id": "promo_test"}] if found else []}

    def construct_event(raw, signature, secret):
        if signature != "signature-valable":
            raise stripe.SignatureVerificationError("signature invalide", signature)
        return events["next"]

    fake = SimpleNamespace(
        api_key=None,
        Customer=SimpleNamespace(create=create_customer),
        checkout=SimpleNamespace(Session=SimpleNamespace(create=create_checkout)),
        billing_portal=SimpleNamespace(Session=SimpleNamespace(create=create_portal)),
        PromotionCode=SimpleNamespace(list=list_promos),
        Subscription=SimpleNamespace(cancel=cancel_subscription),
        InvalidRequestError=stripe.InvalidRequestError,
        Webhook=SimpleNamespace(construct_event=construct_event),
        SignatureVerificationError=stripe.SignatureVerificationError,
        calls=calls,
        events=events,
    )
    monkeypatch.setattr(billing_routes, "stripe", fake)
    return fake


@pytest.fixture
def paid(settings):
    """Service avec une facturation configurée."""
    settings.stripe_secret_key = "sk_test"
    settings.stripe_price_id = "price_test"
    settings.stripe_webhook_secret = "whsec_test"
    settings.site_url = "https://thecode.julsql.fr"
    return settings


def register(client, email="client@exemple.fr", code=""):
    return client.post(
        "/v1/auth/register",
        json={"email": email, "password": PASSWORD, "invite_code": code},
    )


def bearer(response):
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


class TestPlans:
    def test_the_prices_are_public(self, client, settings):
        settings.price_monthly_cents = 200
        response = client.get("/v1/billing/plans")

        assert response.status_code == 200
        body = response.json()
        assert body["price_monthly_cents"] == 200
        assert body["currency"] == "EUR"
        assert body["free_max_entries"] == settings.free_max_entries

    def test_it_says_when_payment_is_not_configured(self, client, settings):
        assert client.get("/v1/billing/plans").json()["billing_available"] is False


class TestCheckout:
    def test_it_refuses_politely_without_stripe(self, client, sent_emails):
        created = register(client)
        response = client.post("/v1/billing/checkout", json={}, headers=bearer(created))

        # 503 et non 500 : ce n'est pas une panne, c'est un service non ouvert.
        assert response.status_code == 503

    def test_it_creates_a_customer_then_a_session(self, client, paid, fake_stripe, sent_emails):
        created = register(client)
        response = client.post(
            "/v1/billing/checkout", json={"return_path": "/fr/account"}, headers=bearer(created)
        )

        assert response.status_code == 200
        assert response.json()["url"] == "https://stripe.test/checkout"
        assert fake_stripe.calls["customers"][0]["email"] == "client@exemple.fr"

        session = fake_stripe.calls["checkout"][0]
        assert session["mode"] == "subscription"
        assert session["customer"] == "cus_test"
        assert session["line_items"] == [{"price": "price_test", "quantity": 1}]
        assert session["success_url"] == "https://thecode.julsql.fr/fr/account?checkout=success"
        # Sans code saisi, c'est Stripe qui propose son champ.
        assert session["allow_promotion_codes"] is True

    def test_the_customer_is_reused(self, client, paid, fake_stripe, sent_emails):
        created = register(client)
        client.post("/v1/billing/checkout", json={}, headers=bearer(created))
        client.post("/v1/billing/checkout", json={}, headers=bearer(created))

        # Un client Stripe par compte : deux clients pour la même personne, et
        # son historique de facturation se coupe en deux.
        assert len(fake_stripe.calls["customers"]) == 1

    def test_a_promo_code_becomes_a_discount(self, client, paid, fake_stripe, sent_emails):
        created = register(client)
        response = client.post(
            "/v1/billing/checkout", json={"promo_code": "REMISE20"}, headers=bearer(created)
        )

        assert response.status_code == 200
        session = fake_stripe.calls["checkout"][0]
        assert session["discounts"] == [{"promotion_code": "promo_test"}]
        # Stripe refuse une remise et son propre champ de code ensemble.
        assert "allow_promotion_codes" not in session

    def test_an_unknown_promo_code_is_refused(self, client, paid, fake_stripe, sent_emails):
        created = register(client)
        response = client.post(
            "/v1/billing/checkout", json={"promo_code": "NIMPORTEQUOI"}, headers=bearer(created)
        )

        assert response.status_code == 404
        assert fake_stripe.calls["checkout"] == []

    def test_a_referral_discount_is_applied(
        self, client, paid, fake_stripe, db_session, sent_emails
    ):
        created = register(client)
        account = db_session.query(Account).one()
        account.pending_coupon = "coupon_parrainage"
        db_session.commit()

        client.post("/v1/billing/checkout", json={}, headers=bearer(created))
        assert fake_stripe.calls["checkout"][0]["discounts"] == [{"coupon": "coupon_parrainage"}]

    @pytest.mark.parametrize(
        "asked",
        ["https://ailleurs.example/piege", "//ailleurs.example", "\\\\ailleurs.example", "sans-slash"],
    )
    def test_the_return_path_cannot_leave_the_site(
        self, client, paid, fake_stripe, sent_emails, asked
    ):
        """Stripe renvoie le navigateur où on lui dit.

        Accepter une URL complète ferait du service un tremplin : un lien de
        paiement forgé ramènerait sur un site qui imite le nôtre, juste après
        une saisie de carte.
        """
        created = register(client)
        client.post("/v1/billing/checkout", json={"return_path": asked}, headers=bearer(created))

        session = fake_stripe.calls["checkout"][0]
        assert session["success_url"].startswith("https://thecode.julsql.fr/en/account")

    def test_an_account_already_paid_is_sent_to_the_portal(
        self, client, paid, fake_stripe, db_session, sent_emails
    ):
        created = register(client)
        account = db_session.query(Account).one()
        account.plan = "pro"
        account.subscription_status = "active"
        db_session.commit()

        response = client.post("/v1/billing/checkout", json={}, headers=bearer(created))
        assert response.status_code == 409


class TestPortal:
    def test_it_needs_a_customer(self, client, paid, fake_stripe, sent_emails):
        created = register(client)
        assert client.post("/v1/billing/portal", json={}, headers=bearer(created)).status_code == 409

    def test_it_returns_the_portal_url(self, client, paid, fake_stripe, db_session, sent_emails):
        created = register(client)
        account = db_session.query(Account).one()
        account.stripe_customer_id = "cus_test"
        db_session.commit()

        response = client.post(
            "/v1/billing/portal", json={"return_path": "/fr/account"}, headers=bearer(created)
        )
        assert response.json()["url"] == "https://stripe.test/portal"
        assert (
            fake_stripe.calls["portal"][0]["return_url"] == "https://thecode.julsql.fr/fr/account"
        )


class TestWebhook:
    def send(self, client, signature="signature-valable"):
        return client.post(
            "/v1/billing/webhook",
            content=b"{}",
            headers={"Stripe-Signature": signature, "Content-Type": "application/json"},
        )

    def test_an_unsigned_call_changes_nothing(self, client, paid, fake_stripe, sent_emails):
        created = register(client)
        fake_stripe.events["next"] = {
            "type": "checkout.session.completed",
            "data": {"object": {"client_reference_id": "peu-importe", "customer": "cus_test"}},
        }

        assert self.send(client, signature="forgee").status_code == 400
        assert client.get("/v1/auth/me", headers=bearer(created)).json()["plan"] == "free"

    def test_a_completed_payment_opens_the_full_plan(
        self, client, paid, fake_stripe, db_session, sent_emails
    ):
        created = register(client)
        account_id = str(db_session.query(Account).one().id)
        fake_stripe.events["next"] = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "client_reference_id": account_id,
                    "customer": "cus_test",
                    "subscription": "sub_test",
                }
            },
        }

        assert self.send(client).status_code == 200
        me = client.get("/v1/auth/me", headers=bearer(created)).json()
        assert me["plan"] == "pro"
        assert me["plan_source"] == "stripe"

    def test_the_referral_discount_is_consumed(
        self, client, paid, fake_stripe, db_session, sent_emails
    ):
        created = register(client)
        account = db_session.query(Account).one()
        account.pending_coupon = "coupon_parrainage"
        db_session.commit()

        fake_stripe.events["next"] = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "client_reference_id": str(account.id),
                    "customer": "cus_test",
                    "subscription": "sub_test",
                }
            },
        }
        self.send(client)

        # La garder la ferait rejouer des mois plus tard, sans que personne ne
        # comprenne pourquoi la facture change.
        assert client.get("/v1/auth/me", headers=bearer(created)).json()["has_pending_coupon"] is (
            False
        )

    def test_a_cancelled_subscription_comes_back_to_free(
        self, client, paid, fake_stripe, db_session, sent_emails
    ):
        created = register(client)
        account = db_session.query(Account).one()
        account.plan = "pro"
        account.subscription_status = "active"
        account.plan_source = "stripe"
        account.stripe_customer_id = "cus_test"
        db_session.commit()

        fake_stripe.events["next"] = {
            "type": "customer.subscription.deleted",
            "data": {"object": {"customer": "cus_test", "metadata": {}}},
        }
        assert self.send(client).status_code == 200
        assert client.get("/v1/auth/me", headers=bearer(created)).json()["plan"] == "free"

    def test_a_lifetime_account_is_never_downgraded(
        self, client, paid, fake_stripe, db_session, sent_emails
    ):
        """Un compte à vie n'a pas d'abonnement Stripe : un événement qui le
        concerne par erreur ne doit pas lui retirer ce qui lui a été donné."""
        created = register(client)
        account = db_session.query(Account).one()
        account.plan = "pro"
        account.subscription_status = "lifetime"
        account.plan_source = "lifetime"
        account.stripe_customer_id = "cus_test"
        db_session.commit()

        fake_stripe.events["next"] = {
            "type": "customer.subscription.deleted",
            "data": {"object": {"customer": "cus_test", "metadata": {}}},
        }
        self.send(client)

        assert client.get("/v1/auth/me", headers=bearer(created)).json()["plan"] == "pro"

    def test_a_past_due_subscription_keeps_working(
        self, client, paid, fake_stripe, db_session, sent_emails
    ):
        """Stripe relance pendant plusieurs jours : couper la synchronisation
        dès le premier échec ferait perdre des données à quelqu'un qui paie."""
        created = register(client)
        account = db_session.query(Account).one()
        account.stripe_customer_id = "cus_test"
        db_session.commit()

        fake_stripe.events["next"] = {
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": "sub_test",
                    "customer": "cus_test",
                    "status": "past_due",
                    "metadata": {},
                    "current_period_end": 1800000000,
                }
            },
        }
        self.send(client)

        me = client.get("/v1/auth/me", headers=bearer(created)).json()
        assert me["plan"] == "pro"
        assert me["subscription_status"] == "past_due"


class TestDeletionAndBilling:
    """Supprimer un compte abonné, c'est aussi arrêter de le facturer."""

    def delete(self, client, created, email="client@exemple.fr"):
        return client.request(
            "DELETE",
            "/v1/account",
            json={"password": PASSWORD, "confirm_email": email},
            headers=bearer(created),
        )

    def test_deleting_cancels_the_subscription(
        self, client, paid, fake_stripe, db_session, sent_emails
    ):
        created = register(client)
        account = db_session.query(Account).one()
        account.stripe_subscription_id = "sub_test"
        db_session.commit()

        assert self.delete(client, created).status_code == 204
        assert fake_stripe.calls["cancelled"] == ["sub_test"]

    def test_a_failed_cancellation_keeps_the_account(
        self, client, paid, fake_stripe, db_session, sent_emails
    ):
        """Dans l'autre ordre, une panne de Stripe laisserait un prélèvement
        mensuel sur un compte qui n'existe plus, et plus personne pour le
        voir."""
        created = register(client)
        account = db_session.query(Account).one()
        account.stripe_subscription_id = "sub_en_panne"
        db_session.commit()

        response = self.delete(client, created)

        assert response.status_code == 502
        assert db_session.query(Account).count() == 1

    def test_a_free_account_needs_no_stripe(self, client, fake_stripe, db_session, sent_emails):
        """Sans abonnement, la suppression ne parle pas à Stripe — et marche
        donc même quand la facturation n'est pas configurée."""
        created = register(client)

        assert self.delete(client, created).status_code == 204
        assert fake_stripe.calls["cancelled"] == []
