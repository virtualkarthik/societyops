from datetime import datetime
from typing import Optional
from sqlalchemy import String, ForeignKey, Index, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class AuditEntry(Base):
    __tablename__ = "audit_entry"
    __table_args__ = (Index("ix_audit_entry_society", "society_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user.id"))
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # CREATE, UPDATE, DELETE
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[Optional[int]]
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    before_json: Mapped[Optional[dict]] = mapped_column(JSON)
    after_json: Mapped[Optional[dict]] = mapped_column(JSON)
