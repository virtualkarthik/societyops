from typing import Optional
from sqlalchemy import String, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

# Platform-wide property structure (Block -> Floor, plus standalone Common
# Areas) so any module -- housekeeping today, assets/complaints later -- can
# reference a real place in the society instead of free-text location strings.


class Block(Base):
    __tablename__ = "block"
    __table_args__ = (Index("ix_block_society", "society_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)


class Floor(Base):
    __tablename__ = "floor"
    __table_args__ = (Index("ix_floor_society", "society_id"), Index("ix_floor_block", "block_id"))

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    block_id: Mapped[int] = mapped_column(ForeignKey("block.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)


class CommonArea(Base):
    __tablename__ = "common_area"
    __table_args__ = (Index("ix_common_area_society", "society_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    # Optional: some common areas belong to one block (e.g. "Block A Terrace"),
    # others are shared across the whole society (e.g. "Main Garden").
    block_id: Mapped[Optional[int]] = mapped_column(ForeignKey("block.id"))
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)
