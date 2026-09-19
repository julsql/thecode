"""Configuration du service.

Tout vient de l'environnement : le service tourne dans un conteneur, et rien
de ce qui est secret ne doit figurer dans l'image.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="THECODE_", env_file=".env")

    database_url: str = "postgresql+psycopg://thecode:thecode@localhost:5432/thecode"

    #: Signature des jetons. Sans valeur explicite le service refuse de démarrer
    #: en production : un secret par défaut serait un secret connu de tous.
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    #: Jeton d'accès court : il circule à chaque requête, il doit expirer vite.
    access_token_minutes: int = 15
    #: Jeton de renouvellement long, mais révocable puisqu'il est en base.
    refresh_token_days: int = 30

    #: Garde-fous anti-abus. Le carnet est petit par nature ; ces bornes
    #: empêchent qu'un compte serve de stockage général.
    max_entries_per_account: int = 2000
    max_blob_bytes: int = 8 * 1024

    #: open   — n'importe qui peut s'inscrire
    #: quota  — libre jusqu'à `free_accounts`, code de parrainage au-delà
    #: invite — il faut connaître le code d'invitation
    #: closed — plus aucune inscription
    #:
    #: `invite` par défaut : un service de synchronisation de mots de passe
    #: ouvert à tous dès le premier jour, sans limitation de débit ni
    #: modération, est une invitation à l'abus.
    registration_mode: str = "invite"

    #: Comptes créés sans code, en mode `quota`. Au-delà, il faut un code de
    #: parrainage — c'est là que passera l'abonnement.
    free_accounts: int = 5
    invite_code: str = ""

    #: Plafonds de l'offre gratuite. La synchronisation reste utilisable pour
    #: en juger sur pièces : deux appareils, c'est le minimum pour que « ça se
    #: synchronise » veuille dire quelque chose. Au-delà, c'est l'abonnement.
    free_max_entries: int = 20
    free_max_devices: int = 2
    #: L'offre payante n'est pas illimitée mais très large : sans borne, un
    #: compte compromis pourrait ouvrir des sessions sans fin.
    pro_max_devices: int = 20

    #: Prix affiché par le site. Stripe reste la source de vérité de ce qui est
    #: facturé ; ces deux valeurs ne servent qu'à l'affichage, pour éviter un
    #: appel à Stripe sur une page publique.
    price_monthly_cents: int = 200
    price_currency: str = "EUR"

    #: Facturation. Sans ces trois valeurs, le service tourne sans paiement :
    #: les pages existent, le bouton d'abonnement répond que c'est indisponible.
    stripe_secret_key: str = ""
    stripe_price_id: str = ""
    #: Signature des webhooks. Sans elle, n'importe qui pourrait s'offrir un
    #: abonnement en appelant l'URL du webhook.
    stripe_webhook_secret: str = ""

    #: Site public : liens de retour après paiement et lien de vérification
    #: d'adresse. Le compte se gère uniquement là.
    site_url: str = "https://thecode.julsql.fr"

    #: Vérification d'adresse. Par défaut la vérification est proposée mais pas
    #: exigée : tant que l'envoi d'e-mail n'est pas branché, l'exiger
    #: enfermerait tout le monde dehors.
    require_email_verification: bool = False
    email_verification_hours: int = 24
    #: log — le lien part dans les journaux du service (développement)
    mail_transport: str = "log"
    mail_from: str = "contact@thecode.julsql.fr"

    environment: str = "development"

    #: Préfixe sous lequel le service est exposé. Vide : il a son propre
    #: sous-domaine et vit à la racine. Le réglage reste, parce qu'un service
    #: remonté derrière un préfixe sans le savoir publie une documentation et
    #: un schéma OpenAPI aux URL inutilisables.
    root_path: str = ""

    #: Origines autorisées à appeler le service depuis un navigateur, séparées
    #: par des virgules.
    #:
    #: Nécessaire puisque l'API a son propre sous-domaine : le site n'est pas
    #: sur la même origine. Les applications natives et les extensions ne sont
    #: pas soumises au CORS, et les jetons circulent dans l'en-tête
    #: Authorization, donc aucune requête n'a besoin de cookies.
    cors_origins: str = "https://thecode.julsql.fr"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def billing_enabled(self) -> bool:
        return bool(self.stripe_secret_key and self.stripe_price_id)

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def registration_open(self) -> bool:
        return self.registration_mode == "open"

    @property
    def registration_closed(self) -> bool:
        return self.registration_mode == "closed"

    @property
    def registration_quota(self) -> bool:
        return self.registration_mode == "quota"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    if settings.registration_mode not in ("open", "quota", "invite", "closed"):
        raise RuntimeError(
            f"THECODE_REGISTRATION_MODE invalide : {settings.registration_mode!r}. "
            "Attendu open, quota, invite ou closed."
        )
    if settings.registration_mode == "quota" and not settings.invite_code:
        raise RuntimeError(
            "THECODE_REGISTRATION_MODE vaut quota mais THECODE_INVITE_CODE est vide : "
            "une fois les places libres prises, plus personne ne pourrait s'inscrire, "
            "et l'erreur ne se verrait qu'à ce moment-là."
        )
    if settings.registration_mode == "invite" and not settings.invite_code:
        raise RuntimeError(
            "THECODE_REGISTRATION_MODE vaut invite mais THECODE_INVITE_CODE est vide : "
            "personne ne pourrait s'inscrire, et l'erreur ne se verrait qu'à l'usage."
        )
    if settings.mail_transport not in ("log",):
        raise RuntimeError(
            f"THECODE_MAIL_TRANSPORT invalide : {settings.mail_transport!r}. Attendu log."
        )
    # Une facturation à moitié configurée est pire que pas de facturation : le
    # bouton mène à Stripe, le paiement passe, et le webhook non signé ne
    # remonte jamais l'abonnement.
    stripe_set = [
        name
        for name, value in (
            ("THECODE_STRIPE_SECRET_KEY", settings.stripe_secret_key),
            ("THECODE_STRIPE_PRICE_ID", settings.stripe_price_id),
            ("THECODE_STRIPE_WEBHOOK_SECRET", settings.stripe_webhook_secret),
        )
        if value
    ]
    if stripe_set and len(stripe_set) != 3:
        raise RuntimeError(
            "Configuration Stripe incomplète : "
            + ", ".join(stripe_set)
            + " défini(s), il faut les trois (clef, prix, secret de webhook) "
            "ou aucun."
        )
    if settings.require_email_verification and settings.mail_transport == "log":
        raise RuntimeError(
            "THECODE_REQUIRE_EMAIL_VERIFICATION est actif alors que les e-mails "
            "ne sont qu'écrits dans les journaux : personne ne recevrait son "
            "lien de vérification, et plus aucun compte ne pourrait servir."
        )
    if settings.is_production and not settings.jwt_secret:
        raise RuntimeError(
            "THECODE_JWT_SECRET doit être défini en production : "
            "une valeur par défaut serait connue de tout le monde."
        )
    return settings
