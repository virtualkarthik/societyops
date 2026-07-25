from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, ForeignKey, Index, Text, DateTime, Date, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class DGLog(Base):
    __tablename__ = "dg_log"
    __table_args__ = (
        Index("ix_dg_log_society", "society_id"),
        UniqueConstraint("society_id", "client_uuid", name="uq_dg_log_society_uuid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    asset_id: Mapped[int] = mapped_column(ForeignKey("asset.id"), nullable=False)
    client_uuid: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    run_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    run_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    run_hours: Mapped[Optional[float]]
    diesel_opening: Mapped[Optional[float]]
    diesel_closing: Mapped[Optional[float]]
    diesel_consumed: Mapped[Optional[float]]
    load_kw: Mapped[Optional[float]]
    frequency: Mapped[Optional[float]]
    voltage: Mapped[Optional[float]]
    operator_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500))


class FuelPurchase(Base):
    __tablename__ = "fuel_purchase"
    __table_args__ = (Index("ix_fuel_purchase_society", "society_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    asset_id: Mapped[Optional[int]] = mapped_column(ForeignKey("asset.id"))
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)
    litres: Mapped[float] = mapped_column(nullable=False)
    cost: Mapped[Optional[float]]
    vendor: Mapped[Optional[str]] = mapped_column(String(200))
