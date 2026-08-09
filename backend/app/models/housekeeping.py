import enum
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Enum, ForeignKey, Index, Text, DateTime, Date, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class HousekeepingAreaType(str, enum.Enum):
    CORRIDOR = "CORRIDOR"
    STAIRCASE = "STAIRCASE"
    LOBBY = "LOBBY"
    PARKING = "PARKING"
    COMMON_ROOM = "COMMON_ROOM"
    CLUBHOUSE = "CLUBHOUSE"
    GARDEN = "GARDEN"
    TERRACE = "TERRACE"
    OTHER = "OTHER"


class HousekeepingActivityType(str, enum.Enum):
    DRY_SWEEPING = "DRY_SWEEPING"
    WET_MOPPING = "WET_MOPPING"
    PARKING_CLEANING = "PARKING_CLEANING"
    ROOM_CLEANING = "ROOM_CLEANING"
    GARBAGE_COLLECTION = "GARBAGE_COLLECTION"
    GLASS_CLEANING = "GLASS_CLEANING"
    OTHER = "OTHER"


class HousekeepingFrequency(str, enum.Enum):
    DAILY = "DAILY"
    ALTERNATE_DAYS = "ALTERNATE_DAYS"
    WEEKLY = "WEEKLY"
    FORTNIGHTLY = "FORTNIGHTLY"
    CUSTOM_DAYS = "CUSTOM_DAYS"


class HousekeepingArea(Base):
    __tablename__ = "housekeeping_area"
    __table_args__ = (Index("ix_housekeeping_area_society", "society_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    area_type: Mapped[HousekeepingAreaType] = mapped_column(Enum(HousekeepingAreaType), nullable=False)
    # Exactly one of these is normally set: a corridor/room on a specific
    # block+floor, or a standalone/common-area location.
    block_id: Mapped[Optional[int]] = mapped_column(ForeignKey("block.id"))
    floor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("floor.id"))
    common_area_id: Mapped[Optional[int]] = mapped_column(ForeignKey("common_area.id"))
    is_active: Mapped[bool] = mapped_column(default=True)


class HousekeepingSchedule(Base):
    """Defines a recurring activity expected for an area, e.g. 'Wet Mopping,
    Weekly' for a given corridor. Drives what shows up as due on /today."""
    __tablename__ = "housekeeping_schedule"
    __table_args__ = (
        Index("ix_housekeeping_schedule_society", "society_id"),
        Index("ix_housekeeping_schedule_area", "area_id"),
        UniqueConstraint("area_id", "activity_type", name="uq_housekeeping_schedule_area_activity"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    area_id: Mapped[int] = mapped_column(ForeignKey("housekeeping_area.id"), nullable=False)
    activity_type: Mapped[HousekeepingActivityType] = mapped_column(Enum(HousekeepingActivityType), nullable=False)
    frequency: Mapped[HousekeepingFrequency] = mapped_column(Enum(HousekeepingFrequency), nullable=False)
    custom_interval_days: Mapped[Optional[int]] = mapped_column(Integer)
    next_due: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)


class HousekeepingLog(Base):
    __tablename__ = "housekeeping_log"
    __table_args__ = (
        Index("ix_housekeeping_log_society", "society_id"),
        Index("ix_housekeeping_log_area", "area_id"),
        UniqueConstraint("society_id", "client_uuid", name="uq_housekeeping_log_society_uuid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    area_id: Mapped[int] = mapped_column(ForeignKey("housekeeping_area.id"), nullable=False)
    schedule_id: Mapped[Optional[int]] = mapped_column(ForeignKey("housekeeping_schedule.id"))
    activity_type: Mapped[HousekeepingActivityType] = mapped_column(Enum(HousekeepingActivityType), nullable=False)
    client_uuid: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500))
