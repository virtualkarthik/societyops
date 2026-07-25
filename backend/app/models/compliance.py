from datetime import date
from typing import Optional
from sqlalchemy import String, ForeignKey, Index, Date
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class ComplianceDoc(Base):
    __tablename__ = "compliance_doc"
    __table_args__ = (Index("ix_compliance_doc_society", "society_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    file: Mapped[Optional[str]] = mapped_column(String(500))
    issue_date: Mapped[Optional[date]] = mapped_column(Date)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date)
    asset_id: Mapped[Optional[int]] = mapped_column(ForeignKey("asset.id"))
    notes: Mapped[Optional[str]] = mapped_column(String(500))
