import enum
from datetime import date
from typing import Optional
from sqlalchemy import String, Enum, ForeignKey, Index, Text, Date, Float, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class ServiceType(str, enum.Enum):
    ROUTINE = "ROUTINE"
    REPAIR = "REPAIR"
    BREAKDOWN = "BREAKDOWN"
    AMC_VISIT = "AMC_VISIT"
    INSPECTION = "INSPECTION"


class ServiceRecord(Base):
    __tablename__ = "service_record"
    __table_args__ = (
        Index("ix_service_record_society", "society_id"),
        Index("ix_service_record_asset", "asset_id"),
        UniqueConstraint("society_id", "client_uuid", name="uq_service_record_society_uuid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    asset_id: Mapped[int] = mapped_column(ForeignKey("asset.id"), nullable=False)
    client_uuid: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    service_date: Mapped[date] = mapped_column(Date, nullable=False)
    service_type: Mapped[ServiceType] = mapped_column(Enum(ServiceType), nullable=False)
    vendor_name: Mapped[Optional[str]] = mapped_column(String(200))
    technician_name: Mapped[Optional[str]] = mapped_column(String(200))
    cost: Mapped[Optional[float]] = mapped_column(Float)
    next_service_due: Mapped[Optional[date]] = mapped_column(Date)
    operator_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500))
