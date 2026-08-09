"""Add LAMP_POST to assettype enum

Revision ID: 004
Revises: 003
Create Date: 2026-08-09 00:00:00
"""
from typing import Sequence, Union
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE assettype ADD VALUE IF NOT EXISTS 'LAMP_POST'")


def downgrade() -> None:
    # Postgres cannot drop a single enum value; downgrading would require
    # rebuilding the type. Not supported for this additive change.
    pass
