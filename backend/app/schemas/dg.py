from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel


class DGLogCreate(BaseModel):
    asset_id: int
    client_uuid: Optional[str] = None
    run_start: datetime
    run_end: Optional[datetime] = None
    run_hours: Optional[float] = None
    diesel_opening: Optional[float] = None
    diesel_closing: Optional[float] = None
    diesel_consumed: Optional[float] = None
    load_kw: Optional[float] = None
    frequency: Optional[float] = None
    voltage: Optional[float] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None


class DGLogOut(DGLogCreate):
    id: int
    society_id: int
    operator_id: Optional[int] = None

    model_config = {"from_attributes": True}


class FuelPurchaseCreate(BaseModel):
    asset_id: Optional[int] = None
    purchase_date: date
    litres: float
    cost: Optional[float] = None
    vendor: Optional[str] = None


class FuelPurchaseOut(FuelPurchaseCreate):
    id: int
    society_id: int

    model_config = {"from_attributes": True}
