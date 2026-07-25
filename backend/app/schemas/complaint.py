from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.complaint import ComplaintStatus


class ComplaintCreate(BaseModel):
    asset_id: Optional[int] = None
    category: Optional[str] = None
    description: str


class ComplaintUpdate(BaseModel):
    status: Optional[ComplaintStatus] = None
    resolution_notes: Optional[str] = None
    asset_id: Optional[int] = None
    category: Optional[str] = None
    description: Optional[str] = None


class ComplaintOut(BaseModel):
    id: int
    society_id: int
    asset_id: Optional[int] = None
    raised_by: Optional[int] = None
    category: Optional[str] = None
    description: str
    status: ComplaintStatus
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None

    model_config = {"from_attributes": True}
