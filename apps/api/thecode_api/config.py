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
    #: invite — il faut connaître le code d'invitation
    #: closed — plus aucune inscription
    #:
    #: `invite` par défaut : un service de synchronisation de mots de passe
    #: ouvert à tous dès le premier jour, sans limitation de débit ni
    #: modération, est une invitation à l'abus.
    registration_mode: str = "invite"
    invite_code: str = ""

    environment: str = "development"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def registration_open(self) -> bool:
        return self.registration_mode == "open"

    @property
    def registration_closed(self) -> bool:
        return self.registration_mode == "closed"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    if settings.registration_mode not in ("open", "invite", "closed"):
        raise RuntimeError(
            f"THECODE_REGISTRATION_MODE invalide : {settings.registration_mode!r}. "
            "Attendu open, invite ou closed."
        )
    if settings.registration_mode == "invite" and not settings.invite_code:
        raise RuntimeError(
            "THECODE_REGISTRATION_MODE vaut invite mais THECODE_INVITE_CODE est vide : "
            "personne ne pourrait s'inscrire, et l'erreur ne se verrait qu'à l'usage."
        )
    if settings.is_production and not settings.jwt_secret:
        raise RuntimeError(
            "THECODE_JWT_SECRET doit être défini en production : "
            "une valeur par défaut serait connue de tout le monde."
        )
    return settings
