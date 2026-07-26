from datetime import date
from typing import Optional
from pydantic import BaseModel
from app.models.service import ServiceType


class ServiceRecordCreate(BaseModel):
    asset_id: int
    client_uuid: Optional[str] = None
    service_date: date
    service_type: ServiceType
    vendor_name: Optional[str] = None
    technician_name: Optional[str] = None
    cost: Optional[float] = None
    next_service_due: Optional[date] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None


class ServiceRecordOut(ServiceRecordCreate):
    id: int
    society_id: int
    operator_id: Optional[int] = None

    model_config = {"from_attributes": True}
