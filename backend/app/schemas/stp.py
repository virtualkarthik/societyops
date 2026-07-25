from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.stp import Shift


class STPLogCreate(BaseModel):
    asset_id: int
    client_uuid: Optional[str] = None
    logged_at: datetime
    shift: Optional[Shift] = None
    ph: Optional[float] = None
    mlss: Optional[float] = None
    chlorine_dosing: Optional[float] = None
    blower_run_hours: Optional[float] = None
    inlet_flow: Optional[float] = None
    outlet_flow: Optional[float] = None
    tank_level: Optional[float] = None
    backwash_done: bool = False
    sludge_removed: bool = False
    power_hours: Optional[float] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None


class STPLogOut(STPLogCreate):
    id: int
    society_id: int
    operator_id: Optional[int] = None

    model_config = {"from_attributes": True}


class STPLabTestCreate(BaseModel):
    asset_id: int
    test_date: datetime
    lab_name: Optional[str] = None
    inlet_bod: Optional[float] = None
    outlet_bod: Optional[float] = None
    inlet_cod: Optional[float] = None
    outlet_cod: Optional[float] = None
    inlet_tss: Optional[float] = None
    outlet_tss: Optional[float] = None
    ph: Optional[float] = None
    coliform: Optional[float] = None


class STPLabTestOut(STPLabTestCreate):
    id: int
    society_id: int
    report_file: Optional[str] = None
    removal_efficiency_bod: Optional[float] = None
    breach_flag: bool
    breach_details: Optional[str] = None

    model_config = {"from_attributes": True}


class ComplianceLimitOut(BaseModel):
    id: int
    society_id: int
    parameter: str
    max_value: Optional[float] = None
    min_value: Optional[float] = None
    unit: Optional[str] = None
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class ComplianceLimitUpdate(BaseModel):
    max_value: Optional[float] = None
    min_value: Optional[float] = None
    unit: Optional[str] = None
    description: Optional[str] = None
