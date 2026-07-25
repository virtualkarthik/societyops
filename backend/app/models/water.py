from datetime import datetime
from typing import Optional
from sqlalchemy import String, ForeignKey, Index, Text, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class WaterLog(Base):
    __tablename__ = "water_log"
    __table_args__ = (
        Index("ix_water_log_society", "society_id"),
        UniqueConstraint("society_id", "client_uuid", name="uq_water_log_society_uuid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    asset_id: Mapped[int] = mapped_column(ForeignKey("asset.id"), nullable=False)
    client_uuid: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    borewell_run_hours: Mapped[Optional[float]]
    water_level: Mapped[Optional[float]]
    motor_health_note: Mapped[Optional[str]] = mapped_column(String(500))
    sump_level: Mapped[Optional[float]]
    oht_level: Mapped[Optional[float]]
    operator_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500))


class TankerDelivery(Base):
    __tablename__ = "tanker_delivery"
    __table_args__ = (Index("ix_tanker_delivery_society", "society_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    quantity_litres: Mapped[float] = mapped_column(nullable=False)
    cost: Mapped[Optional[float]]
    vendor: Mapped[Optional[str]] = mapped_column(String(200))
    operator_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
