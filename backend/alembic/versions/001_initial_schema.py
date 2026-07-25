"""Initial schema

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "society",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("address", sa.Text),
        sa.Column("builtup_area_sqm", sa.Float),
        sa.Column("cto_number", sa.String(100)),
        sa.Column("cto_expiry", sa.Date),
        sa.Column("contact_email", sa.String(200)),
        sa.Column("contact_phone", sa.String(20)),
    )

    op.create_table(
        "user",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(200), nullable=False, unique=True),
        sa.Column("phone", sa.String(20)),
        sa.Column("role", sa.Enum("super_admin", "committee", "operator", "resident", name="userrole"), nullable=False),
        sa.Column("password_hash", sa.String(256), nullable=False),
        sa.Column("is_active", sa.Boolean, default=True),
    )
    op.create_index("ix_user_society", "user", ["society_id"])

    op.create_table(
        "asset",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("type", sa.Enum("STP", "BOREWELL", "SUMP", "OHT", "DG", "LIFT", "FIRE",
                                   "PUMP", "TRANSFORMER", "SOLAR", "WATER_METER", "OTHER",
                                   name="assettype"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("make", sa.String(100)),
        sa.Column("model", sa.String(100)),
        sa.Column("capacity_value", sa.Float),
        sa.Column("capacity_unit", sa.String(50)),
        sa.Column("install_date", sa.Date),
        sa.Column("warranty_expiry", sa.Date),
        sa.Column("amc_vendor", sa.String(200)),
        sa.Column("amc_expiry", sa.Date),
        sa.Column("rated_params_json", postgresql.JSON),
        sa.Column("qr_token", sa.String(64), unique=True, nullable=False),
        sa.Column("location", sa.String(200)),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("notes", sa.Text),
    )
    op.create_index("ix_asset_society", "asset", ["society_id"])

    op.create_table(
        "stp_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("asset_id", sa.Integer, sa.ForeignKey("asset.id"), nullable=False),
        sa.Column("client_uuid", sa.String(36)),
        sa.Column("logged_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("shift", sa.Enum("AM", "PM", "NIGHT", name="shift")),
        sa.Column("ph", sa.Float), sa.Column("mlss", sa.Float),
        sa.Column("chlorine_dosing", sa.Float), sa.Column("blower_run_hours", sa.Float),
        sa.Column("inlet_flow", sa.Float), sa.Column("outlet_flow", sa.Float),
        sa.Column("tank_level", sa.Float),
        sa.Column("backwash_done", sa.Boolean, default=False),
        sa.Column("sludge_removed", sa.Boolean, default=False),
        sa.Column("power_hours", sa.Float),
        sa.Column("operator_id", sa.Integer, sa.ForeignKey("user.id")),
        sa.Column("notes", sa.Text),
        sa.Column("photo_url", sa.String(500)),
        sa.UniqueConstraint("society_id", "client_uuid", name="uq_stp_log_society_uuid"),
    )
    op.create_index("ix_stp_log_society", "stp_log", ["society_id"])

    op.create_table(
        "stp_lab_test",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("asset_id", sa.Integer, sa.ForeignKey("asset.id"), nullable=False),
        sa.Column("test_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lab_name", sa.String(200)),
        sa.Column("inlet_bod", sa.Float), sa.Column("outlet_bod", sa.Float),
        sa.Column("inlet_cod", sa.Float), sa.Column("outlet_cod", sa.Float),
        sa.Column("inlet_tss", sa.Float), sa.Column("outlet_tss", sa.Float),
        sa.Column("ph", sa.Float), sa.Column("coliform", sa.Float),
        sa.Column("report_file", sa.String(500)),
        sa.Column("removal_efficiency_bod", sa.Float),
        sa.Column("breach_flag", sa.Boolean, default=False),
        sa.Column("breach_details", sa.Text),
    )
    op.create_index("ix_stp_lab_test_society", "stp_lab_test", ["society_id"])

    op.create_table(
        "compliance_limit",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("parameter", sa.String(50), nullable=False),
        sa.Column("max_value", sa.Float), sa.Column("min_value", sa.Float),
        sa.Column("unit", sa.String(20)), sa.Column("description", sa.String(200)),
        sa.UniqueConstraint("society_id", "parameter", name="uq_compliance_limit_society_param"),
    )
    op.create_index("ix_compliance_limit_society", "compliance_limit", ["society_id"])

    op.create_table(
        "water_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("asset_id", sa.Integer, sa.ForeignKey("asset.id"), nullable=False),
        sa.Column("client_uuid", sa.String(36)),
        sa.Column("logged_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("borewell_run_hours", sa.Float), sa.Column("water_level", sa.Float),
        sa.Column("motor_health_note", sa.String(500)),
        sa.Column("sump_level", sa.Float), sa.Column("oht_level", sa.Float),
        sa.Column("operator_id", sa.Integer, sa.ForeignKey("user.id")),
        sa.Column("notes", sa.Text), sa.Column("photo_url", sa.String(500)),
        sa.UniqueConstraint("society_id", "client_uuid", name="uq_water_log_society_uuid"),
    )
    op.create_index("ix_water_log_society", "water_log", ["society_id"])

    op.create_table(
        "tanker_delivery",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("logged_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("quantity_litres", sa.Float, nullable=False),
        sa.Column("cost", sa.Float), sa.Column("vendor", sa.String(200)),
        sa.Column("operator_id", sa.Integer, sa.ForeignKey("user.id")),
        sa.Column("notes", sa.Text),
    )
    op.create_index("ix_tanker_delivery_society", "tanker_delivery", ["society_id"])

    op.create_table(
        "dg_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("asset_id", sa.Integer, sa.ForeignKey("asset.id"), nullable=False),
        sa.Column("client_uuid", sa.String(36)),
        sa.Column("run_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("run_end", sa.DateTime(timezone=True)),
        sa.Column("run_hours", sa.Float), sa.Column("diesel_opening", sa.Float),
        sa.Column("diesel_closing", sa.Float), sa.Column("diesel_consumed", sa.Float),
        sa.Column("load_kw", sa.Float), sa.Column("frequency", sa.Float),
        sa.Column("voltage", sa.Float),
        sa.Column("operator_id", sa.Integer, sa.ForeignKey("user.id")),
        sa.Column("notes", sa.Text), sa.Column("photo_url", sa.String(500)),
        sa.UniqueConstraint("society_id", "client_uuid", name="uq_dg_log_society_uuid"),
    )
    op.create_index("ix_dg_log_society", "dg_log", ["society_id"])

    op.create_table(
        "fuel_purchase",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("asset_id", sa.Integer, sa.ForeignKey("asset.id")),
        sa.Column("purchase_date", sa.Date, nullable=False),
        sa.Column("litres", sa.Float, nullable=False),
        sa.Column("cost", sa.Float), sa.Column("vendor", sa.String(200)),
    )
    op.create_index("ix_fuel_purchase_society", "fuel_purchase", ["society_id"])

    op.create_table(
        "ppm_task",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("asset_id", sa.Integer, sa.ForeignKey("asset.id")),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("category", sa.String(100)),
        sa.Column("frequency", sa.Enum(
            "DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "HALFYEARLY", "YEARLY", "CUSTOM_DAYS",
            name="ppmfrequency"), nullable=False),
        sa.Column("custom_interval_days", sa.Integer),
        sa.Column("next_due", sa.Date),
        sa.Column("assignee_id", sa.Integer, sa.ForeignKey("user.id")),
        sa.Column("checklist_json", postgresql.JSON),
        sa.Column("is_statutory", sa.Boolean, default=False),
        sa.Column("escalate_after_days", sa.Integer, default=7),
        sa.Column("is_active", sa.Boolean, default=True),
    )
    op.create_index("ix_ppm_task_society", "ppm_task", ["society_id"])

    op.create_table(
        "ppm_completion",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("task_id", sa.Integer, sa.ForeignKey("ppm_task.id"), nullable=False),
        sa.Column("client_uuid", sa.String(36)),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_by", sa.Integer, sa.ForeignKey("user.id")),
        sa.Column("checklist_result_json", postgresql.JSON),
        sa.Column("proof_photos_json", postgresql.JSON),
        sa.Column("geo_lat", sa.Float), sa.Column("geo_lng", sa.Float),
        sa.Column("notes", sa.Text),
        sa.UniqueConstraint("society_id", "client_uuid", name="uq_ppm_completion_society_uuid"),
    )
    op.create_index("ix_ppm_completion_society", "ppm_completion", ["society_id"])

    op.create_table(
        "complaint",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("asset_id", sa.Integer, sa.ForeignKey("asset.id")),
        sa.Column("raised_by", sa.Integer, sa.ForeignKey("user.id")),
        sa.Column("category", sa.String(100)),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("status", sa.Enum("OPEN", "IN_PROGRESS", "RESOLVED", name="complaintstatus"),
                  default="OPEN"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("resolution_notes", sa.Text),
    )
    op.create_index("ix_complaint_society", "complaint", ["society_id"])

    op.create_table(
        "inventory_item",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("unit", sa.String(50), nullable=False),
        sa.Column("current_stock", sa.Float, default=0.0),
        sa.Column("reorder_level", sa.Float),
        sa.Column("linked_asset_type", sa.String(50)),
    )
    op.create_index("ix_inventory_item_society", "inventory_item", ["society_id"])

    op.create_table(
        "inventory_txn",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("item_id", sa.Integer, sa.ForeignKey("inventory_item.id"), nullable=False),
        sa.Column("txn_type", sa.Enum("PURCHASE", "CONSUME", name="txntype"), nullable=False),
        sa.Column("quantity", sa.Float, nullable=False),
        sa.Column("cost", sa.Float),
        sa.Column("asset_id", sa.Integer, sa.ForeignKey("asset.id")),
        sa.Column("txn_date", sa.Date, nullable=False),
    )
    op.create_index("ix_inventory_txn_society", "inventory_txn", ["society_id"])

    op.create_table(
        "compliance_doc",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("doc_type", sa.String(100), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("file", sa.String(500)),
        sa.Column("issue_date", sa.Date), sa.Column("expiry_date", sa.Date),
        sa.Column("asset_id", sa.Integer, sa.ForeignKey("asset.id")),
        sa.Column("notes", sa.String(500)),
    )
    op.create_index("ix_compliance_doc_society", "compliance_doc", ["society_id"])

    op.create_table(
        "audit_entry",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("society_id", sa.Integer, sa.ForeignKey("society.id"), nullable=False),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("user.id")),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", sa.Integer),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("before_json", postgresql.JSON),
        sa.Column("after_json", postgresql.JSON),
    )
    op.create_index("ix_audit_entry_society", "audit_entry", ["society_id"])


def downgrade() -> None:
    for tbl in [
        "audit_entry", "compliance_doc", "inventory_txn", "inventory_item",
        "complaint", "ppm_completion", "ppm_task", "fuel_purchase", "dg_log",
        "tanker_delivery", "water_log", "compliance_limit", "stp_lab_test",
        "stp_log", "asset", "user", "society",
    ]:
        op.drop_table(tbl)
    for enum in ["userrole", "assettype", "shift", "ppmfrequency", "complaintstatus", "txntype"]:
        sa.Enum(name=enum).drop(op.get_bind(), checkfirst=True)
