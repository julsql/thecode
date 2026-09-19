"""connexion Google et liens a trois usages

Ajoute l'identifiant Google du compte, et donne aux liens envoyes par courrier
un usage et une adresse cible : confirmer une adresse, confirmer un changement
d'adresse, reinitialiser un mot de passe.

Les lignes existantes prennent l'usage `verify` : c'etait le seul jusqu'ici.

Revision ID: b7e3d18c0a52
Revises: a1c4f2b90d31
Create Date: 2026-09-19
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b7e3d18c0a52"
down_revision: str | None = "a1c4f2b90d31"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("google_sub", sa.String(length=64), nullable=False, server_default=""),
    )
    op.create_index("ix_accounts_google_sub", "accounts", ["google_sub"], unique=False)

    op.add_column(
        "email_verifications",
        sa.Column("purpose", sa.String(length=16), nullable=False, server_default="verify"),
    )
    op.add_column(
        "email_verifications",
        sa.Column("new_email", sa.String(length=320), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("email_verifications", "new_email")
    op.drop_column("email_verifications", "purpose")
    op.drop_index("ix_accounts_google_sub", table_name="accounts")
    op.drop_column("accounts", "google_sub")
