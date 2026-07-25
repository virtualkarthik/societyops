from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import CurrentUser, DB
from app.models.complaint import Complaint, ComplaintStatus
from app.schemas.complaint import ComplaintCreate, ComplaintUpdate, ComplaintOut
from app.services.audit import log_audit

router = APIRouter(prefix="/complaints", tags=["complaints"])


@router.get("", response_model=list[ComplaintOut])
async def list_complaints(current_user: CurrentUser, db: DB, status_filter: str | None = None):
    q = select(Complaint).where(Complaint.society_id == current_user.society_id)
    if status_filter:
        q = q.where(Complaint.status == status_filter)
    result = await db.execute(q.order_by(Complaint.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ComplaintOut, status_code=status.HTTP_201_CREATED)
async def create_complaint(body: ComplaintCreate, current_user: CurrentUser, db: DB):
    complaint = Complaint(
        society_id=current_user.society_id,
        raised_by=current_user.id,
        created_at=datetime.now(timezone.utc),
        **body.model_dump(),
    )
    db.add(complaint)
    await db.flush()
    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "Complaint", complaint.id)
    await db.commit()
    await db.refresh(complaint)
    return complaint


@router.patch("/{complaint_id}", response_model=ComplaintOut)
async def update_complaint(complaint_id: int, body: ComplaintUpdate, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Complaint).where(Complaint.id == complaint_id, Complaint.society_id == current_user.society_id)
    )
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Not found")

    before = {"status": complaint.status}
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(complaint, k, v)

    if body.status == ComplaintStatus.RESOLVED and not complaint.resolved_at:
        complaint.resolved_at = datetime.now(timezone.utc)

    await log_audit(db, current_user.society_id, current_user.id, "UPDATE", "Complaint", complaint.id,
                    before=before, after=body.model_dump(exclude_unset=True))
    await db.commit()
    await db.refresh(complaint)
    return complaint
