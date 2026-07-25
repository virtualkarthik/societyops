import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Enum, ForeignKey, Index, Text, DateTime, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Shift(str, enum.Enum):
    AM = "AM"
    PM = "PM"
    NIGHT = "NIGHT"


class STPLog(Base):
    __tablename__ = "stp_log"
    __table_args__ = (
        Index("ix_stp_log_society", "society_id"),
        UniqueConstraint("society_id", "client_uuid", name="uq_stp_log_society_uuid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    asset_id: Mapped[int] = mapped_column(ForeignKey("asset.id"), nullable=False)
    client_uuid: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    shift: Mapped[Optional[Shift]] = mapped_column(Enum(Shift))
    ph: Mapped[Optional[float]]
    mlss: Mapped[Optional[float]]
    chlorine_dosing: Mapped[Optional[float]]
    blower_run_hours: Mapped[Optional[float]]
    inlet_flow: Mapped[Optional[float]]
    outlet_flow: Mapped[Optional[float]]
    tank_level: Mapped[Optional[float]]
    backwash_done: Mapped[bool] = mapped_column(Boolean, default=False)
    sludge_removed: Mapped[bool] = mapped_column(Boolean, default=False)
    power_hours: Mapped[Optional[float]]
    operator_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500))


class STPLabTest(Base):
    __tablename__ = "stp_lab_test"
    __table_args__ = (Index("ix_stp_lab_test_society", "society_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    asset_id: Mapped[int] = mapped_column(ForeignKey("asset.id"), nullable=False)
    test_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    lab_name: Mapped[Optional[str]] = mapped_column(String(200))
    inlet_bod: Mapped[Optional[float]]
    outlet_bod: Mapped[Optional[float]]
    inlet_cod: Mapped[Optional[float]]
    outlet_cod: Mapped[Optional[float]]
    inlet_tss: Mapped[Optional[float]]
    outlet_tss: Mapped[Optional[float]]
    ph: Mapped[Optional[float]]
    coliform: Mapped[Optional[float]]
    report_file: Mapped[Optional[str]] = mapped_column(String(500))
    removal_efficiency_bod: Mapped[Optional[float]]
    breach_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    breach_details: Mapped[Optional[str]] = mapped_column(Text)


class ComplianceLimit(Base):
    """Editable TNPCB/CPCB threshold configuration per society."""
    __tablename__ = "compliance_limit"
    __table_args__ = (
        Index("ix_compliance_limit_society", "society_id"),
        UniqueConstraint("society_id", "parameter", name="uq_compliance_limit_society_param"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    parameter: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. "bod", "tss", "ph_min"
    max_value: Mapped[Optional[float]]
    min_value: Mapped[Optional[float]]
    unit: Mapped[Optional[str]] = mapped_column(String(20))
    description: Mapped[Optional[str]] = mapped_column(String(200))
