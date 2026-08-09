import enum
import secrets
from datetime import date
from typing import Optional
from sqlalchemy import String, Enum, ForeignKey, Index, Text, Date, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class AssetType(str, enum.Enum):
    STP = "STP"
    BOREWELL = "BOREWELL"
    SUMP = "SUMP"
    OHT = "OHT"
    DG = "DG"
    LIFT = "LIFT"
    FIRE = "FIRE"
    PUMP = "PUMP"
    TRANSFORMER = "TRANSFORMER"
    SOLAR = "SOLAR"
    WATER_METER = "WATER_METER"
    LAMP_POST = "LAMP_POST"
    OTHER = "OTHER"


class Asset(Base):
    __tablename__ = "asset"
    __table_args__ = (Index("ix_asset_society", "society_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    type: Mapped[AssetType] = mapped_column(Enum(AssetType), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    make: Mapped[Optional[str]] = mapped_column(String(100))
    model: Mapped[Optional[str]] = mapped_column(String(100))
    serial_number: Mapped[Optional[str]] = mapped_column(String(100))
    capacity_value: Mapped[Optional[float]]
    capacity_unit: Mapped[Optional[str]] = mapped_column(String(50))
    install_date: Mapped[Optional[date]] = mapped_column(Date)
    warranty_expiry: Mapped[Optional[date]] = mapped_column(Date)
    purchase_date: Mapped[Optional[date]] = mapped_column(Date)
    purchase_cost: Mapped[Optional[float]]
    purchased_from: Mapped[Optional[str]] = mapped_column(String(200))
    amc_vendor: Mapped[Optional[str]] = mapped_column(String(200))
    amc_expiry: Mapped[Optional[date]] = mapped_column(Date)
    rated_params_json: Mapped[Optional[dict]] = mapped_column(JSON)
    qr_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False,
                                           default=lambda: secrets.token_urlsafe(16))
    location: Mapped[Optional[str]] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    society: Mapped["Society"] = relationship(back_populates="assets")  # noqa: F821
    ppm_tasks: Mapped[list["PPMTask"]] = relationship(back_populates="asset")  # noqa: F821
