"""Modèle de données.

Le serveur ne voit jamais le contenu d'un carnet : il stocke des blobs
chiffrés côté client, avec juste ce qu'il faut de métadonnées pour savoir
lesquels ont changé.

Ce qui reste visible pour l'exploitant, et qu'il faut assumer : le nombre
d'entrées d'un compte et la fréquence de ses synchronisations.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    LargeBinary,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class Account(Base):
    """Un compte de synchronisation.

    Volontairement distinct de la clef maîtresse : celle-ci ne doit jamais
    servir à s'authentifier, sinon une faiblesse du service exposerait les mots
    de passe eux-mêmes.
    """

    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    #: Compteur monotone : le client demande ce qui a changé depuis sa dernière
    #: révision, plutôt que de tout retélécharger.
    revision: Mapped[int] = mapped_column(BigInteger, default=0)

    plan: Mapped[str] = mapped_column(String(32), default="free")
    subscription_status: Mapped[str] = mapped_column(String(32), default="active")

    entries: Mapped[list[VaultEntry]] = relationship(back_populates="account", cascade="all, delete-orphan")
    sessions: Mapped[list[Session]] = relationship(back_populates="account", cascade="all, delete-orphan")


class VaultEntry(Base):
    """Une entrée de carnet, chiffrée.

    `blob` et `nonce` sont opaques pour le serveur. `entry_id` est l'identifiant
    que le client utilise pour fusionner : il est stocké tel quel, ce qui permet
    de savoir quelles entrées ont changé sans rien déchiffrer.
    """

    __tablename__ = "vault_entries"
    __table_args__ = (
        UniqueConstraint("account_id", "entry_id", name="uq_vault_entry"),
        Index("ix_vault_entries_account_revision", "account_id", "revision"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    entry_id: Mapped[str] = mapped_column(String(64))

    nonce: Mapped[bytes] = mapped_column(LargeBinary(32))
    blob: Mapped[bytes] = mapped_column(LargeBinary)

    #: Révision du compte au moment de l'écriture : sert au delta.
    revision: Mapped[int] = mapped_column(BigInteger, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    #: Pierre tombale : une suppression doit se propager aux autres appareils,
    #: sinon elle serait annulée à la fusion suivante.
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)

    account: Mapped[Account] = relationship(back_populates="entries")


class Session(Base):
    """Un jeton de renouvellement, donc un appareil connecté.

    Stocké haché : une fuite de la base ne doit pas permettre de se connecter.
    Le stocker en base est ce qui rend « déconnecter cet appareil » possible.
    """

    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)

    account: Mapped[Account] = relationship(back_populates="sessions")
