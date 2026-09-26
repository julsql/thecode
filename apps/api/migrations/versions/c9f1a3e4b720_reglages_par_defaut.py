"""reglages par defaut du compte

Ajoute la table `default_settings` : une ligne par compte au plus, un blob
chiffre cote client, efface avec le compte.

Revision ID: c9f1a3e4b720
Revises: b7e3d18c0a52
Create Date: 2026-09-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c9f1a3e4b720"
down_revision: str | None = "b7e3d18c0a52"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "default_settings",
        sa.Column("account_id", sa.UUID(), nullable=False),
        sa.Column("nonce", sa.LargeBinary(length=32), nullable=False),
        sa.Column("blob", sa.LargeBinary(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("account_id"),
    )


def downgrade() -> None:
    op.drop_table("default_settings")
