from datetime import date
from typing import Optional
from pydantic import BaseModel


class ComplianceDocCreate(BaseModel):
    doc_type: str
    title: str
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    asset_id: Optional[int] = None
    notes: Optional[str] = None


class ComplianceDocOut(ComplianceDocCreate):
    id: int
    society_id: int
    file: Optional[str] = None

    model_config = {"from_attributes": True}
