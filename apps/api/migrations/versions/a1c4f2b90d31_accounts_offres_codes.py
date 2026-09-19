"""offres, verification d'adresse et codes

Ajoute ce qu'il faut pour distinguer une offre gratuite d'une offre payante,
confirmer une adresse, et faire vivre les codes d'invitation, de parrainage et
a vie.

Les colonnes ajoutees a `accounts` portent un server_default : la table n'est
pas vide en production, et une colonne non nulle sans valeur par defaut ferait
echouer la migration sur le premier compte existant.

Revision ID: a1c4f2b90d31
Revises: 62d5d1ad9691
Create Date: 2026-09-19
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1c4f2b90d31"
down_revision: str | None = "62d5d1ad9691"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "accounts", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "accounts",
        sa.Column("plan_source", sa.String(length=16), nullable=False, server_default="none"),
    )
    op.add_column(
        "accounts",
        sa.Column("stripe_customer_id", sa.String(length=64), nullable=False, server_default=""),
    )
    op.add_column(
        "accounts",
        sa.Column(
            "stripe_subscription_id", sa.String(length=64), nullable=False, server_default=""
        ),
    )
    op.add_column(
        "accounts", sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "accounts",
        sa.Column("pending_coupon", sa.String(length=64), nullable=False, server_default=""),
    )

    op.create_table(
        "email_verifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("account_id", sa.UUID(), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_email_verifications_account_id", "email_verifications", ["account_id"], unique=False
    )
    op.create_index(
        "ix_email_verifications_token_hash", "email_verifications", ["token_hash"], unique=True
    )

    op.create_table(
        "codes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("stripe_coupon_id", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("max_uses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("note", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_codes_code", "codes", ["code"], unique=True)

    op.create_table(
        "code_redemptions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("account_id", sa.UUID(), nullable=False),
        sa.Column("code_id", sa.UUID(), nullable=False),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["code_id"], ["codes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id", "code_id", name="uq_code_redemption"),
    )
    op.create_index(
        "ix_code_redemptions_account_id", "code_redemptions", ["account_id"], unique=False
    )
    op.create_index("ix_code_redemptions_code_id", "code_redemptions", ["code_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_code_redemptions_code_id", table_name="code_redemptions")
    op.drop_index("ix_code_redemptions_account_id", table_name="code_redemptions")
    op.drop_table("code_redemptions")
    op.drop_index("ix_codes_code", table_name="codes")
    op.drop_table("codes")
    op.drop_index("ix_email_verifications_token_hash", table_name="email_verifications")
    op.drop_index("ix_email_verifications_account_id", table_name="email_verifications")
    op.drop_table("email_verifications")
    op.drop_column("accounts", "pending_coupon")
    op.drop_column("accounts", "current_period_end")
    op.drop_column("accounts", "stripe_subscription_id")
    op.drop_column("accounts", "stripe_customer_id")
    op.drop_column("accounts", "plan_source")
    op.drop_column("accounts", "email_verified_at")
