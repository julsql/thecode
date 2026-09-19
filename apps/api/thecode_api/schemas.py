"""Schémas d'entrée et de sortie.

Les blobs circulent en base64url : le JSON ne transporte pas d'octets bruts, et
l'encodage sans padding évite les surprises dans les URL et les logs.
"""

from __future__ import annotations

import base64
import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, field_validator


def b64decode(value: str) -> bytes:
    """Décode du base64url, en refusant tout caractère invalide.

    Sans validate=True, la bibliothèque standard ignore silencieusement les
    caractères hors alphabet : un blob corrompu serait accepté et stocké
    tronqué, et le client échouerait au déchiffrement sans savoir pourquoi.
    """
    # urlsafe_b64decode n'accepte pas validate : on traduit l'alphabet puis on
    # décode strictement.
    standard = value.replace("-", "+").replace("_", "/")
    return base64.b64decode(standard + "=" * (-len(standard) % 4), validate=True)


def b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


class RegisterRequest(BaseModel):
    email: EmailStr
    # 12 caractères minimum : ce mot de passe protège la synchronisation, pas
    # les mots de passe eux-mêmes, mais il reste la porte d'entrée du compte.
    password: Annotated[str, Field(min_length=12, max_length=256)]
    #: Code d'invitation, de parrainage ou à vie. Requis quand le service
    #: tourne en mode invitation, ou quand les places gratuites sont prises.
    invite_code: Annotated[str, Field(max_length=128)] = ""
    device_label: Annotated[str, Field(max_length=120)] = ""
    #: Langue du lien de vérification : il mène au site, qui est traduit.
    lang: Annotated[str, Field(max_length=5)] = "en"


class LoginRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=1, max_length=256)]
    device_label: Annotated[str, Field(max_length=120)] = ""


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class EntryPayload(BaseModel):
    """Une entrée chiffrée. Le serveur n'en lit jamais le contenu."""

    entry_id: Annotated[str, Field(min_length=1, max_length=64)]
    nonce: str
    blob: str
    deleted: bool = False

    @field_validator("nonce", "blob")
    @classmethod
    def must_be_base64url(cls, value: str) -> str:
        try:
            b64decode(value)
        except Exception as exc:
            raise ValueError("base64url attendu") from exc
        return value


class PushRequest(BaseModel):
    """Écriture par lot.

    `base_revision` est la révision sur laquelle le client a travaillé : si le
    serveur a avancé depuis, on refuse plutôt que d'écraser ce qu'un autre
    appareil a écrit entre-temps.
    """

    base_revision: int
    entries: list[EntryPayload]


class EntryResponse(BaseModel):
    entry_id: str
    nonce: str
    blob: str
    deleted: bool
    revision: int


class PullResponse(BaseModel):
    revision: int
    entries: list[EntryResponse]


class PushResponse(BaseModel):
    revision: int
    accepted: int


class AccountResponse(BaseModel):
    """Ce que la page du compte a besoin de savoir, et rien de plus."""

    email: EmailStr
    plan: str
    subscription_status: str
    revision: int
    entry_count: int
    max_entries: int
    #: Nul tant que l'adresse n'est pas confirmée.
    email_verified: bool = False
    plan_source: str = "none"
    device_count: int = 0
    max_devices: int = 0
    current_period_end: datetime | None = None
    has_pending_coupon: bool = False
    #: Faux pour un compte créé par Google et qui n'a pas posé de mot de passe.
    has_password: bool = True
    google_linked: bool = False
    #: Adresse en attente de confirmation, vide s'il n'y en a pas.
    pending_email: str = ""
    #: Faux quand le paiement n'est pas configuré : le site doit alors dire
    #: que l'abonnement est indisponible plutôt que d'ouvrir un lien mort.
    billing_available: bool = False


class VerifyRequest(BaseModel):
    token: Annotated[str, Field(min_length=1, max_length=256)]


class GoogleRequest(BaseModel):
    """Le jeton d'identité rendu par Google au navigateur."""

    id_token: Annotated[str, Field(min_length=1, max_length=4096)]
    device_label: Annotated[str, Field(max_length=120)] = ""
    invite_code: Annotated[str, Field(max_length=128)] = ""
    lang: Annotated[str, Field(max_length=5)] = "en"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    lang: Annotated[str, Field(max_length=5)] = "en"


class ResetPasswordRequest(BaseModel):
    token: Annotated[str, Field(min_length=1, max_length=256)]
    password: Annotated[str, Field(min_length=12, max_length=256)]


class ChangePasswordRequest(BaseModel):
    """Le mot de passe actuel, sauf quand le compte n'en a pas encore.

    Un compte créé par Google n'a pas de mot de passe : en exiger un
    reviendrait à lui interdire d'en poser un, donc à lui interdire les
    applications, qui ne savent se connecter que comme ça.
    """

    current_password: Annotated[str, Field(max_length=256)] = ""
    new_password: Annotated[str, Field(min_length=12, max_length=256)]


class ChangeEmailRequest(BaseModel):
    new_email: EmailStr
    #: Exigé quand le compte a un mot de passe : changer l'adresse d'un compte
    #: ouvert sur un écran resté déverrouillé serait sinon un jeu d'enfant.
    password: Annotated[str, Field(max_length=256)] = ""
    lang: Annotated[str, Field(max_length=5)] = "en"


class ResendVerificationRequest(BaseModel):
    lang: Annotated[str, Field(max_length=5)] = "en"


class CodeRequest(BaseModel):
    code: Annotated[str, Field(min_length=1, max_length=64)]


class CodeResponse(BaseModel):
    kind: str
    message: str


class CheckoutRequest(BaseModel):
    #: Code promotionnel Stripe saisi sur le site, facultatif.
    promo_code: Annotated[str, Field(max_length=64)] = ""
    #: Chemin du site où revenir après le paiement, langue comprise. Vérifié
    #: côté serveur : une URL complète permettrait de renvoyer l'utilisateur
    #: n'importe où après un passage par Stripe.
    return_path: Annotated[str, Field(max_length=200)] = "/en/account"


class CheckoutResponse(BaseModel):
    url: str


class DeviceResponse(BaseModel):
    """Une session vivante, donc un appareil connecté.

    Rien ne dit lequel est celui qui regarde : le jeton d'accès ne porte que le
    compte. Se déconnecter soi-même depuis cette liste revient à se
    déconnecter, ce qui est récupérable — l'inverse (cacher une session) ne le
    serait pas.
    """

    id: uuid.UUID
    label: str
    created_at: datetime
    expires_at: datetime


class PlansResponse(BaseModel):
    """Tarifs publics, lus par la page des offres sans être connecté."""

    price_monthly_cents: int
    currency: str
    billing_available: bool
    free_max_entries: int
    free_max_devices: int
    pro_max_entries: int
    pro_max_devices: int
