from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel
from app.models.housekeeping import HousekeepingAreaType, HousekeepingActivityType


class HousekeepingAreaCreate(BaseModel):
    name: str
    area_type: HousekeepingAreaType
    location: Optional[str] = None
    expected_activities: Optional[list[HousekeepingActivityType]] = None
    is_active: bool = True


class HousekeepingAreaUpdate(HousekeepingAreaCreate):
    name: Optional[str] = None
    area_type: Optional[HousekeepingAreaType] = None


class HousekeepingAreaOut(HousekeepingAreaCreate):
    id: int
    society_id: int

    model_config = {"from_attributes": True}


class HousekeepingLogCreate(BaseModel):
    area_id: int
    activity_type: HousekeepingActivityType
    client_uuid: Optional[str] = None
    logged_at: datetime
    notes: Optional[str] = None
    photo_url: Optional[str] = None


class HousekeepingLogOut(HousekeepingLogCreate):
    id: int
    society_id: int
    completed_by: Optional[int] = None

    model_config = {"from_attributes": True}


class TodayActivityStatus(BaseModel):
    activity_type: HousekeepingActivityType
    done: bool
    logged_at: Optional[datetime] = None
    completed_by_name: Optional[str] = None
    log_id: Optional[int] = None


class TodayAreaStatus(BaseModel):
    area_id: int
    area_name: str
    area_type: HousekeepingAreaType
    activities: list[TodayActivityStatus]
    all_done: bool


class HousekeepingTodayOut(BaseModel):
    date: date
    areas: list[TodayAreaStatus]
    total_expected: int
    total_done: int
