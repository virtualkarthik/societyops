from datetime import datetime, date
from typing import Optional, Any
from pydantic import BaseModel
from app.models.ppm import PPMFrequency


class PPMTaskCreate(BaseModel):
    asset_id: Optional[int] = None
    title: str
    category: Optional[str] = None
    frequency: PPMFrequency
    custom_interval_days: Optional[int] = None
    next_due: Optional[date] = None
    assignee_id: Optional[int] = None
    checklist_json: Optional[list[Any]] = None
    is_statutory: bool = False
    escalate_after_days: int = 7


class PPMTaskUpdate(PPMTaskCreate):
    title: Optional[str] = None
    frequency: Optional[PPMFrequency] = None


class PPMTaskOut(PPMTaskCreate):
    id: int
    society_id: int
    is_active: bool

    model_config = {"from_attributes": True}


class PPMCompletionCreate(BaseModel):
    task_id: int
    client_uuid: Optional[str] = None
    completed_at: datetime
    checklist_result_json: Optional[dict[str, Any]] = None
    proof_photos_json: Optional[list[Any]] = None
    geo_lat: Optional[float] = None
    geo_lng: Optional[float] = None
    notes: Optional[str] = None


class PPMCompletionOut(PPMCompletionCreate):
    id: int
    society_id: int
    completed_by: Optional[int] = None

    model_config = {"from_attributes": True}
