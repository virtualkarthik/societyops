from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class WaterLogCreate(BaseModel):
    asset_id: int
    client_uuid: Optional[str] = None
    logged_at: datetime
    borewell_run_hours: Optional[float] = None
    water_level: Optional[float] = None
    motor_health_note: Optional[str] = None
    sump_level: Optional[float] = None
    oht_level: Optional[float] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None


class WaterLogOut(WaterLogCreate):
    id: int
    society_id: int
    operator_id: Optional[int] = None

    model_config = {"from_attributes": True}


class TankerDeliveryCreate(BaseModel):
    logged_at: datetime
    quantity_litres: float
    cost: Optional[float] = None
    vendor: Optional[str] = None
    notes: Optional[str] = None


class TankerDeliveryOut(TankerDeliveryCreate):
    id: int
    society_id: int
    operator_id: Optional[int] = None

    model_config = {"from_attributes": True}
