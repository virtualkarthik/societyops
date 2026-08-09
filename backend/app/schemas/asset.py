from datetime import date
from typing import Optional, Any
from pydantic import BaseModel
from app.models.asset import AssetType


class AssetCreate(BaseModel):
    type: AssetType
    name: str
    make: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    capacity_value: Optional[float] = None
    capacity_unit: Optional[str] = None
    install_date: Optional[date] = None
    warranty_expiry: Optional[date] = None
    purchase_date: Optional[date] = None
    purchase_cost: Optional[float] = None
    purchased_from: Optional[str] = None
    amc_vendor: Optional[str] = None
    amc_expiry: Optional[date] = None
    rated_params_json: Optional[dict[str, Any]] = None
    location: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None


class AssetUpdate(AssetCreate):
    type: Optional[AssetType] = None
    name: Optional[str] = None


class AssetOut(AssetCreate):
    id: int
    society_id: int
    qr_token: str

    model_config = {"from_attributes": True}
