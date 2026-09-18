"""Schémas d'entrée et de sortie.

Les blobs circulent en base64url : le JSON ne transporte pas d'octets bruts, et
l'encodage sans padding évite les surprises dans les URL et les logs.
"""

from __future__ import annotations

import base64
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
    #: Requis quand le service tourne en mode invitation.
    invite_code: Annotated[str, Field(max_length=128)] = ""


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
    email: EmailStr
    plan: str
    subscription_status: str
    revision: int
    entry_count: int
    max_entries: int
