import enum
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Enum, ForeignKey, Index, Text, DateTime, Date, Boolean, JSON, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class PPMFrequency(str, enum.Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    HALFYEARLY = "HALFYEARLY"
    YEARLY = "YEARLY"
    CUSTOM_DAYS = "CUSTOM_DAYS"


class PPMTask(Base):
    __tablename__ = "ppm_task"
    __table_args__ = (Index("ix_ppm_task_society", "society_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    asset_id: Mapped[Optional[int]] = mapped_column(ForeignKey("asset.id"))
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100))
    frequency: Mapped[PPMFrequency] = mapped_column(Enum(PPMFrequency), nullable=False)
    custom_interval_days: Mapped[Optional[int]] = mapped_column(Integer)
    next_due: Mapped[Optional[date]] = mapped_column(Date)
    assignee_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"))
    checklist_json: Mapped[Optional[list]] = mapped_column(JSON)
    is_statutory: Mapped[bool] = mapped_column(Boolean, default=False)
    escalate_after_days: Mapped[int] = mapped_column(Integer, default=7)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    asset: Mapped[Optional["Asset"]] = relationship(back_populates="ppm_tasks")  # noqa: F821
    completions: Mapped[list["PPMCompletion"]] = relationship(back_populates="task")


class PPMCompletion(Base):
    __tablename__ = "ppm_completion"
    __table_args__ = (
        Index("ix_ppm_completion_society", "society_id"),
        UniqueConstraint("society_id", "client_uuid", name="uq_ppm_completion_society_uuid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    task_id: Mapped[int] = mapped_column(ForeignKey("ppm_task.id"), nullable=False)
    client_uuid: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"))
    checklist_result_json: Mapped[Optional[dict]] = mapped_column(JSON)
    proof_photos_json: Mapped[Optional[list]] = mapped_column(JSON)
    geo_lat: Mapped[Optional[float]]
    geo_lng: Mapped[Optional[float]]
    notes: Mapped[Optional[str]] = mapped_column(Text)

    task: Mapped["PPMTask"] = relationship(back_populates="completions")
