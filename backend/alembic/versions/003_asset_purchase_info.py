"""Add serial number and purchase info to asset

Revision ID: 003
Revises: 002
Create Date: 2026-08-09 00:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("asset", sa.Column("serial_number", sa.String(100)))
    op.add_column("asset", sa.Column("purchase_date", sa.Date))
    op.add_column("asset", sa.Column("purchase_cost", sa.Float))
    op.add_column("asset", sa.Column("purchased_from", sa.String(200)))


def downgrade() -> None:
    op.drop_column("asset", "purchased_from")
    op.drop_column("asset", "purchase_cost")
    op.drop_column("asset", "purchase_date")
    op.drop_column("asset", "serial_number")
