from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel
from app.models.housekeeping import HousekeepingAreaType, HousekeepingActivityType, HousekeepingFrequency


class HousekeepingAreaCreate(BaseModel):
    name: str
    area_type: HousekeepingAreaType
    block_id: Optional[int] = None
    floor_id: Optional[int] = None
    common_area_id: Optional[int] = None
    is_active: bool = True


class HousekeepingAreaUpdate(HousekeepingAreaCreate):
    name: Optional[str] = None
    area_type: Optional[HousekeepingAreaType] = None


class HousekeepingAreaOut(HousekeepingAreaCreate):
    id: int
    society_id: int

    model_config = {"from_attributes": True}


class HousekeepingScheduleCreate(BaseModel):
    area_id: int
    activity_type: HousekeepingActivityType
    frequency: HousekeepingFrequency
    custom_interval_days: Optional[int] = None
    next_due: Optional[date] = None
    is_active: bool = True


class HousekeepingScheduleUpdate(BaseModel):
    frequency: Optional[HousekeepingFrequency] = None
    custom_interval_days: Optional[int] = None
    next_due: Optional[date] = None
    is_active: Optional[bool] = None


class HousekeepingScheduleOut(BaseModel):
    id: int
    society_id: int
    area_id: int
    activity_type: HousekeepingActivityType
    frequency: HousekeepingFrequency
    custom_interval_days: Optional[int] = None
    next_due: date
    is_active: bool

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
    schedule_id: Optional[int] = None
    completed_by: Optional[int] = None

    model_config = {"from_attributes": True}


class TodayActivityStatus(BaseModel):
    schedule_id: int
    activity_type: HousekeepingActivityType
    frequency: HousekeepingFrequency
    done: bool
    overdue: bool
    logged_at: Optional[datetime] = None
    completed_by_name: Optional[str] = None
    log_id: Optional[int] = None
    next_due: date


class TodayAreaStatus(BaseModel):
    area_id: int
    area_name: str
    area_type: HousekeepingAreaType
    location_label: str
    activities: list[TodayActivityStatus]
    all_done: bool


class HousekeepingTodayOut(BaseModel):
    date: date
    areas: list[TodayAreaStatus]
    total_expected: int
    total_done: int
