"""connexion Apple

Ajoute l'identifiant Apple du compte (`accounts.apple_sub`), vide quand il
n'est pas lié. Unique parmi les valeurs non vides : un index partiel, puisque
tous les comptes non liés partagent la chaîne vide.

Revision ID: e5b9c3d7a214
Revises: d4a8e2f61c93
Create Date: 2026-09-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e5b9c3d7a214"
down_revision: str | None = "d4a8e2f61c93"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("apple_sub", sa.String(length=255), nullable=False, server_default=""),
    )
    op.create_index(
        "ix_accounts_apple_sub",
        "accounts",
        ["apple_sub"],
        unique=True,
        postgresql_where=sa.text("apple_sub <> ''"),
    )


def downgrade() -> None:
    op.drop_index("ix_accounts_apple_sub", table_name="accounts")
    op.drop_column("accounts", "apple_sub")
