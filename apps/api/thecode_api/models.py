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
    Integer,
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

    #: Renseigné quand l'adresse a été confirmée. Nul tant qu'elle ne l'est
    #: pas : une date vaut mieux qu'un booléen, elle dit aussi quand.
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None, nullable=True
    )

    #: Origine de l'offre : stripe (abonnement payé), lifetime (code à vie),
    #: none (offre gratuite). Sert à ne pas rétrograder un compte à vie quand
    #: Stripe annonce la fin d'un abonnement qu'il n'a jamais eu.
    plan_source: Mapped[str] = mapped_column(String(16), default="none")

    stripe_customer_id: Mapped[str] = mapped_column(String(64), default="")
    stripe_subscription_id: Mapped[str] = mapped_column(String(64), default="")
    #: Fin de la période payée, telle que Stripe la donne. Affichée au compte ;
    #: le serveur ne s'en sert pas pour décider, c'est le statut qui décide.
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None, nullable=True
    )

    #: Code de parrainage saisi à l'inscription et pas encore consommé : la
    #: remise s'applique au moment de l'abonnement, qui vient plus tard.
    pending_coupon: Mapped[str] = mapped_column(String(64), default="")

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


class EmailVerification(Base):
    """Un lien de vérification d'adresse.

    Stocké haché, comme les jetons de renouvellement : lire la base ne doit pas
    suffire à confirmer l'adresse de quelqu'un d'autre.
    """

    __tablename__ = "email_verifications"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None, nullable=True
    )


class Code(Base):
    """Un code saisi par un utilisateur : invitation, parrainage ou à vie.

    Les trois vivent dans la même table parce qu'ils sont saisis au même
    endroit et se ressemblent en tout point sauf l'effet :

    - ``invite``   : ouvre l'inscription quand les places gratuites sont prises
    - ``referral`` : applique une remise Stripe à l'abonnement
    - ``lifetime`` : donne l'offre payante à vie, sans paiement
    """

    __tablename__ = "codes"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    #: Toujours stocké en majuscules : un code recopié à la main ne doit pas
    #: échouer sur une histoire de casse.
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    kind: Mapped[str] = mapped_column(String(16))
    #: Identifiant de coupon Stripe, pour les codes de parrainage avec remise.
    stripe_coupon_id: Mapped[str] = mapped_column(String(64), default="")
    #: 0 = sans limite d'usage.
    max_uses: Mapped[int] = mapped_column(Integer, default=0)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None, nullable=True
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    note: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class CodeRedemption(Base):
    """Qui a utilisé quel code.

    L'unicité par compte empêche de rejouer le même code à l'infini, ce qui
    pour un code à vie n'aurait aucun effet, mais pour un code à usage limité
    en épuiserait les places.
    """

    __tablename__ = "code_redemptions"
    __table_args__ = (UniqueConstraint("account_id", "code_id", name="uq_code_redemption"),)

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    code_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("codes.id", ondelete="CASCADE"), index=True
    )
    redeemed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
