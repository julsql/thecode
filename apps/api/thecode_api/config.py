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

    #: Les plafonds de l'offre gratuite s'appliquent-ils ?
    #:
    #: Vrai par défaut : le carnet local reste illimité, mais ce qui est
    #: *synchronisé* est borné tant que le compte n'est pas débloqué. Faux
    #: ouvre tout à tout le monde, pour un service qui ne veut rien distinguer.
    #:
    #: Indépendant de `billing_enabled` : débloquer se fait aujourd'hui par
    #: code, et se fera demain par abonnement. Ce sont deux questions séparées,
    #: et les confondre revient à annoncer un prix pour quelque chose qui ne se
    #: vend pas encore.
    plans_enabled: bool = True

    #: Plafond de l'offre gratuite : ce qu'un compte peut *synchroniser*.
    #:
    #: Le carnet local n'est jamais bridé — les entrées au-delà restent sur
    #: l'appareil et les mots de passe continuent de se calculer. Ce qui est
    #: borné, c'est le service rendu par le serveur.
    free_max_entries: int = 5
    #: L'offre gratuite couvre l'usage courant — un téléphone, un ordinateur et
    #: un navigateur — sans aller au-delà : c'est aussi ce qui distingue les deux
    #: offres, avec le nombre d'entrées.
    free_max_devices: int = 3
    #: L'offre payante n'est pas illimitée mais large : sans borne, un compte
    #: compromis pourrait ouvrir des sessions sans fin.
    pro_max_devices: int = 10
    #: Sessions du site ouvertes en même temps, quelle que soit l'offre.
    #:
    #: Le site ne compte pas dans le plafond d'appareils — c'est là qu'on en
    #: déconnecte un. Sans borne à part, se déclarer « site » suffirait à
    #: ouvrir des sessions sans fin. Au-delà, la plus ancienne session du site
    #: est déconnectée : jamais de refus, le site doit toujours s'ouvrir.
    web_max_sessions: int = 5

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

    #: Identifiant client Google, pour « continuer avec Google ». Vide : le
    #: bouton n'apparaît pas, et le service refuse les jetons Google.
    #:
    #: Il sert d'audience à la vérification : sans lui, un jeton émis pour une
    #: toute autre application serait accepté ici.
    google_client_id: str = ""
    #: Autres identifiants client Google acceptés en audience, séparés par des
    #: virgules. Vide par défaut.
    #:
    #: Le site, l'extension et Android obtiennent un jeton émis pour le client
    #: web ci-dessus. iOS et macOS passent par un client de type « iOS », que
    #: Google impose pour ce flux, et dont les jetons portent donc une autre
    #: audience. Ces identifiants ne sont jamais publiés par
    #: `/v1/auth/registration` : chaque application embarque le sien.
    google_extra_client_ids: str = ""

    #: Identifiants acceptés en audience des jetons « Se connecter avec
    #: Apple » obtenus par les applications, séparés par des virgules : le
    #: bundle id (p. ex. `fr.julsql.thecode`). Jamais publiés : chaque
    #: application embarque le sien.
    apple_client_ids: str = ""
    #: Services ID du site (Apple JS, p. ex. `fr.julsql.thecode.web`), accepté
    #: lui aussi en audience. Public par construction : il est publié par
    #: `/v1/auth/registration` pour que le site n'ait pas à le recopier.
    #:
    #: Sans aucun des deux, Apple est désactivé et le service refuse ses jetons.
    apple_web_client_id: str = ""

    #: Vérification d'adresse. Par défaut la vérification est proposée mais pas
    #: exigée : tant que l'envoi d'e-mail n'est pas branché, l'exiger
    #: enfermerait tout le monde dehors.
    require_email_verification: bool = False
    email_verification_hours: int = 24
    #: Un lien de réinitialisation ouvre le compte : il doit vivre moins
    #: longtemps qu'un lien de confirmation, qui ne donne rien de plus que ce
    #: que son destinataire a déjà.
    password_reset_hours: int = 2
    #: log  — le lien part dans les journaux du service (développement)
    #: smtp — envoi réel
    mail_transport: str = "log"
    #: Adresse d'expédition. Avec Gmail, elle doit être celle du compte
    #: authentifié ou un alias vérifié dans ses réglages : Gmail réécrit
    #: l'expéditeur sinon, et le courrier part d'une adresse inattendue.
    mail_from: str = "contact@thecode.julsql.fr"
    #: Adresse de réponse, quand elle diffère de l'expéditeur.
    #:
    #: N'entre dans aucune vérification anti-usurpation : elle ne sert qu'aux
    #: humains, dont certains répondent aux courriers automatiques. Elle permet
    #: de garder l'adresse du domaine visible sans sacrifier l'acheminement.
    mail_reply_to: str = ""
    mail_host: str = "smtp.gmail.com"
    mail_port: int = 587
    mail_user: str = ""
    mail_password: str = ""
    #: STARTTLS sur le port 587 ; à désactiver seulement pour un serveur
    #: implicitement chiffré sur 465, auquel cas la connexion est en TLS dès
    #: le départ.
    mail_starttls: bool = True

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
    def google_enabled(self) -> bool:
        return bool(self.google_client_id)

    @property
    def google_audiences(self) -> list[str]:
        """Audiences acceptées : le client web d'abord, puis les autres.

        Sans client web, aucune : les identifiants supplémentaires ne suffisent
        pas à ouvrir la connexion Google, le site ne saurait pas l'afficher.
        """
        if not self.google_client_id:
            return []
        extra = [cid.strip() for cid in self.google_extra_client_ids.split(",") if cid.strip()]
        return [self.google_client_id, *(cid for cid in extra if cid != self.google_client_id)]

    @property
    def apple_audiences(self) -> list[str]:
        """Les applications d'abord, puis le site, sans doublon."""
        seen: list[str] = []
        for cid in [*self.apple_client_ids.split(","), self.apple_web_client_id]:
            cid = cid.strip()
            if cid and cid not in seen:
                seen.append(cid)
        return seen

    @property
    def apple_enabled(self) -> bool:
        return bool(self.apple_audiences)

    @property
    def billing_enabled(self) -> bool:
        """Peut-on souscrire, c'est-à-dire payer ?

        Il faut Stripe *et* des offres qui distinguent quelque chose : facturer
        alors que tout est ouvert reviendrait à faire payer ce que les autres
        ont gratuitement.

        Faux ne veut pas dire « tout est ouvert » : aujourd'hui les plafonds
        s'appliquent et se lèvent par code. C'est ce que le site doit dire,
        plutôt que d'afficher un prix.
        """
        return self.plans_enabled and bool(self.stripe_secret_key and self.stripe_price_id)

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
    if settings.mail_transport not in ("log", "smtp"):
        raise RuntimeError(
            f"THECODE_MAIL_TRANSPORT invalide : {settings.mail_transport!r}. "
            "Attendu log ou smtp."
        )
    if settings.mail_transport == "smtp" and not (
        settings.mail_host and settings.mail_user and settings.mail_password
    ):
        raise RuntimeError(
            "THECODE_MAIL_TRANSPORT vaut smtp mais l'hôte, l'utilisateur ou le mot "
            "de passe manque : aucun courrier ne partirait, et l'erreur ne se "
            "verrait qu'à la première inscription."
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
