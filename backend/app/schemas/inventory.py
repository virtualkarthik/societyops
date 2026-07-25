from datetime import date
from typing import Optional
from pydantic import BaseModel
from app.models.inventory import TxnType


class InventoryItemCreate(BaseModel):
    name: str
    unit: str
    current_stock: float = 0.0
    reorder_level: Optional[float] = None
    linked_asset_type: Optional[str] = None


class InventoryItemOut(InventoryItemCreate):
    id: int
    society_id: int

    model_config = {"from_attributes": True}


class InventoryTxnCreate(BaseModel):
    item_id: int
    txn_type: TxnType
    quantity: float
    cost: Optional[float] = None
    asset_id: Optional[int] = None
    txn_date: date


class InventoryTxnOut(InventoryTxnCreate):
    id: int
    society_id: int

    model_config = {"from_attributes": True}
