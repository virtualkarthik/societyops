"""Add housekeeping_area and housekeeping_log tables

Revision ID: 005
Revises: 004
Create Date: 2026-08-09 00:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "housekeeping_area",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("area_type", sa.Enum(
            "CORRIDOR", "STAIRCASE", "LOBBY", "PARKING", "COMMON_ROOM",
            "CLUBHOUSE", "GARDEN", "TERRACE", "OTHER",
            name="housekeepingareatype"), nullable=False),
        sa.Column("location", sa.String(200)),
        sa.Column("expected_activities", sa.JSON),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_housekeeping_area_society", "housekeeping_area", ["society_id"])

    op.create_table(
        "housekeeping_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("area_id", sa.Integer, sa.ForeignKey("housekeeping_area.id"), nullable=False),
        sa.Column("activity_type", sa.Enum(
            "DRY_SWEEPING", "WET_MOPPING", "PARKING_CLEANING", "ROOM_CLEANING",
            "GARBAGE_COLLECTION", "GLASS_CLEANING", "OTHER",
            name="housekeepingactivitytype"), nullable=False),
        sa.Column("client_uuid", sa.String(36)),
        sa.Column("logged_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_by", sa.Integer, sa.ForeignKey("user.id")),
        sa.Column("notes", sa.Text),
        sa.Column("photo_url", sa.String(500)),
        sa.UniqueConstraint("society_id", "client_uuid", name="uq_housekeeping_log_society_uuid"),
    )
    op.create_index("ix_housekeeping_log_society", "housekeeping_log", ["society_id"])
    op.create_index("ix_housekeeping_log_area", "housekeeping_log", ["area_id"])


def downgrade() -> None:
    op.drop_index("ix_housekeeping_log_area", table_name="housekeeping_log")
    op.drop_index("ix_housekeeping_log_society", table_name="housekeeping_log")
    op.drop_table("housekeeping_log")
    op.execute("DROP TYPE IF EXISTS housekeepingactivitytype")

    op.drop_index("ix_housekeeping_area_society", table_name="housekeeping_area")
    op.drop_table("housekeeping_area")
    op.execute("DROP TYPE IF EXISTS housekeepingareatype")
