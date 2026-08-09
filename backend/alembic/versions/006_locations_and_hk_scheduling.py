"""Add Block/Floor/CommonArea and housekeeping scheduling

Revision ID: 006
Revises: 005
Create Date: 2026-08-09 00:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "block",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_block_society", "block", ["society_id"])

    op.create_table(
        "floor",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("block_id", sa.Integer, sa.ForeignKey("block.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_floor_society", "floor", ["society_id"])
    op.create_index("ix_floor_block", "floor", ["block_id"])

    op.create_table(
        "common_area",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("block_id", sa.Integer, sa.ForeignKey("block.id")),
        sa.Column("description", sa.Text),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_common_area_society", "common_area", ["society_id"])

    # housekeeping_area: drop free-text location + flat activity list,
    # replace with structured FKs into the new location tables.
    op.drop_column("housekeeping_area", "location")
    op.drop_column("housekeeping_area", "expected_activities")
    op.add_column("housekeeping_area", sa.Column("block_id", sa.Integer, sa.ForeignKey("block.id")))
    op.add_column("housekeeping_area", sa.Column("floor_id", sa.Integer, sa.ForeignKey("floor.id")))
    op.add_column("housekeeping_area", sa.Column("common_area_id", sa.Integer, sa.ForeignKey("common_area.id")))

    op.create_table(
        "housekeeping_schedule",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("area_id", sa.Integer, sa.ForeignKey("housekeeping_area.id"), nullable=False),
        sa.Column("activity_type", postgresql.ENUM(
            "DRY_SWEEPING", "WET_MOPPING", "PARKING_CLEANING", "ROOM_CLEANING",
            "GARBAGE_COLLECTION", "GLASS_CLEANING", "OTHER",
            name="housekeepingactivitytype", create_type=False), nullable=False),
        sa.Column("frequency", sa.Enum(
            "DAILY", "ALTERNATE_DAYS", "WEEKLY", "FORTNIGHTLY", "CUSTOM_DAYS",
            name="housekeepingfrequency"), nullable=False),
        sa.Column("custom_interval_days", sa.Integer),
        sa.Column("next_due", sa.Date, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("area_id", "activity_type", name="uq_housekeeping_schedule_area_activity"),
    )
    op.create_index("ix_housekeeping_schedule_society", "housekeeping_schedule", ["society_id"])
    op.create_index("ix_housekeeping_schedule_area", "housekeeping_schedule", ["area_id"])

    op.add_column("housekeeping_log", sa.Column("schedule_id", sa.Integer, sa.ForeignKey("housekeeping_schedule.id")))


def downgrade() -> None:
    op.drop_column("housekeeping_log", "schedule_id")

    op.drop_index("ix_housekeeping_schedule_area", table_name="housekeeping_schedule")
    op.drop_index("ix_housekeeping_schedule_society", table_name="housekeeping_schedule")
    op.drop_table("housekeeping_schedule")
    op.execute("DROP TYPE IF EXISTS housekeepingfrequency")

    op.drop_column("housekeeping_area", "common_area_id")
    op.drop_column("housekeeping_area", "floor_id")
    op.drop_column("housekeeping_area", "block_id")
    op.add_column("housekeeping_area", sa.Column("expected_activities", sa.JSON))
    op.add_column("housekeeping_area", sa.Column("location", sa.String(200)))

    op.drop_index("ix_common_area_society", table_name="common_area")
    op.drop_table("common_area")

    op.drop_index("ix_floor_block", table_name="floor")
    op.drop_index("ix_floor_society", table_name="floor")
    op.drop_table("floor")

    op.drop_index("ix_block_society", table_name="block")
    op.drop_table("block")
