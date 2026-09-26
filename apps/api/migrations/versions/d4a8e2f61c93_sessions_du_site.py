"""sessions du site

Ajoute `sessions.client` : `web` pour une session ouverte par le site, hors du
plafond d'appareils ; `app` pour tout le reste. Les sessions existantes du
site se reconnaissent à l'étiquette qu'il envoyait, « site web ».

Revision ID: d4a8e2f61c93
Revises: c9f1a3e4b720
Create Date: 2026-09-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d4a8e2f61c93"
down_revision: str | None = "c9f1a3e4b720"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("client", sa.String(length=8), nullable=False, server_default="app"),
    )
    op.execute("UPDATE sessions SET client = 'web' WHERE label = 'site web'")


def downgrade() -> None:
    op.drop_column("sessions", "client")
