"""jetons Apple

Ajoute le jeton de renouvellement rendu par Apple à la connexion
(`accounts.apple_refresh_token`) et l'audience qui l'a émis
(`accounts.apple_client_id`), pour pouvoir le révoquer à la suppression du
compte comme Apple l'exige.

Revision ID: f6c1d2e8b935
Revises: e5b9c3d7a214
Create Date: 2026-09-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f6c1d2e8b935"
down_revision: str | None = "e5b9c3d7a214"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("apple_refresh_token", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "accounts",
        sa.Column("apple_client_id", sa.String(length=255), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("accounts", "apple_client_id")
    op.drop_column("accounts", "apple_refresh_token")
