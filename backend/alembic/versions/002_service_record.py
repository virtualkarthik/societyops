"""Add service_record table

Revision ID: 002
Revises: 001
Create Date: 2026-07-26 00:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "service_record",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("asset_id", sa.Integer, sa.ForeignKey("asset.id"), nullable=False),
        sa.Column("client_uuid", sa.String(36)),
        sa.Column("service_date", sa.Date, nullable=False),
        sa.Column("service_type", sa.Enum(
            "ROUTINE", "REPAIR", "BREAKDOWN", "AMC_VISIT", "INSPECTION",
            name="servicetype"), nullable=False),
        sa.Column("vendor_name", sa.String(200)),
        sa.Column("technician_name", sa.String(200)),
        sa.Column("cost", sa.Float),
        sa.Column("next_service_due", sa.Date),
        sa.Column("operator_id", sa.Integer, sa.ForeignKey("user.id")),
        sa.Column("notes", sa.Text),
        sa.Column("photo_url", sa.String(500)),
        sa.UniqueConstraint("society_id", "client_uuid", name="uq_service_record_society_uuid"),
    )
    op.create_index("ix_service_record_society", "service_record", ["society_id"])
    op.create_index("ix_service_record_asset", "service_record", ["asset_id"])


def downgrade() -> None:
    op.drop_index("ix_service_record_asset", table_name="service_record")
    op.drop_index("ix_service_record_society", table_name="service_record")
    op.drop_table("service_record")
    op.execute("DROP TYPE IF EXISTS servicetype")
