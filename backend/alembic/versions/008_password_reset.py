"""Forced password change + emailed temporary password

Revision ID: 008
Revises: 007
Create Date: 2026-10-27 00:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user", sa.Column("must_change_password", sa.Boolean, nullable=False, server_default=sa.false()))
    op.add_column("user", sa.Column("temp_password_hash", sa.String(256)))
    op.add_column("user", sa.Column("temp_password_expires_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("user", "temp_password_expires_at")
    op.drop_column("user", "temp_password_hash")
    op.drop_column("user", "must_change_password")
