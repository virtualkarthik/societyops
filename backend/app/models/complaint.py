import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Enum, ForeignKey, Index, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class ComplaintStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


class Complaint(Base):
    __tablename__ = "complaint"
    __table_args__ = (Index("ix_complaint_society", "society_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    asset_id: Mapped[Optional[int]] = mapped_column(ForeignKey("asset.id"))
    raised_by: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"))
    category: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ComplaintStatus] = mapped_column(Enum(ComplaintStatus), default=ComplaintStatus.OPEN)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text)
