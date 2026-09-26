"""sel de dérivation par compte

Ajoute `accounts.kdf_salt` : 16 octets aléatoires par compte, qui entrent dans
la dérivation de la clef de synchronisation (shared/spec/vault-sync.md, v2).

Les comptes existants reçoivent chacun un sel tiré ici. Les blobs du carnet et
des réglages, chiffrés au format v1 (sel fixe, sans données associées), ne sont
plus lisibles par aucun client : ils sont effacés. Le service n'a jamais été en
production, la base ne contient que des données de test.

Revision ID: a7d2e9c4f158
Revises: f6c1d2e8b935
Create Date: 2026-09-26
"""

from __future__ import annotations

import os
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a7d2e9c4f158"
down_revision: str | None = "f6c1d2e8b935"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DELETE FROM vault_entries")
    op.execute("DELETE FROM default_settings")

    op.add_column("accounts", sa.Column("kdf_salt", sa.LargeBinary(length=16), nullable=True))
    # Un sel par compte, tiré par le générateur du système : pas de valeur par
    # défaut SQL, qui donnerait le même sel à tous ou dépendrait de pgcrypto.
    bind = op.get_bind()
    accounts = sa.table("accounts", sa.column("id"), sa.column("kdf_salt", sa.LargeBinary))
    for (account_id,) in bind.execute(sa.select(accounts.c.id)).all():
        bind.execute(
            accounts.update()
            .where(accounts.c.id == account_id)
            .values(kdf_salt=os.urandom(16))
        )
    op.alter_column("accounts", "kdf_salt", nullable=False)


def downgrade() -> None:
    op.drop_column("accounts", "kdf_salt")
