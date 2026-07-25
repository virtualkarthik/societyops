import enum
from datetime import date
from typing import Optional
from sqlalchemy import String, Enum, ForeignKey, Index, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class TxnType(str, enum.Enum):
    PURCHASE = "PURCHASE"
    CONSUME = "CONSUME"


class InventoryItem(Base):
    __tablename__ = "inventory_item"
    __table_args__ = (Index("ix_inventory_item_society", "society_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    current_stock: Mapped[float] = mapped_column(default=0.0)
    reorder_level: Mapped[Optional[float]]
    linked_asset_type: Mapped[Optional[str]] = mapped_column(String(50))

    transactions: Mapped[list["InventoryTxn"]] = relationship(back_populates="item")


class InventoryTxn(Base):
    __tablename__ = "inventory_txn"
    __table_args__ = (Index("ix_inventory_txn_society", "society_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_item.id"), nullable=False)
    txn_type: Mapped[TxnType] = mapped_column(Enum(TxnType), nullable=False)
    quantity: Mapped[float] = mapped_column(nullable=False)
    cost: Mapped[Optional[float]]
    asset_id: Mapped[Optional[int]] = mapped_column(ForeignKey("asset.id"))
    txn_date: Mapped[date] = mapped_column(Date, nullable=False)

    item: Mapped["InventoryItem"] = relationship(back_populates="transactions")
