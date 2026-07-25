from datetime import date, timedelta
from fastapi import APIRouter, HTTPException, UploadFile, status
from sqlalchemy import select

from app.core.deps import CurrentUser, DB
from app.models.compliance import ComplianceDoc
from app.schemas.compliance import ComplianceDocCreate, ComplianceDocOut
from app.services.audit import log_audit
from app.storage import save_upload

router = APIRouter(prefix="/compliance", tags=["compliance"])


@router.get("/docs", response_model=list[ComplianceDocOut])
async def list_docs(current_user: CurrentUser, db: DB, expiring_within_days: int | None = None):
    q = select(ComplianceDoc).where(ComplianceDoc.society_id == current_user.society_id)
    if expiring_within_days is not None:
        cutoff = date.today() + timedelta(days=expiring_within_days)
        q = q.where(ComplianceDoc.expiry_date <= cutoff, ComplianceDoc.expiry_date >= date.today())
    result = await db.execute(q.order_by(ComplianceDoc.expiry_date.asc()))
    return result.scalars().all()


@router.post("/docs", response_model=ComplianceDocOut, status_code=status.HTTP_201_CREATED)
async def create_doc(body: ComplianceDocCreate, current_user: CurrentUser, db: DB):
    doc = ComplianceDoc(society_id=current_user.society_id, **body.model_dump())
    db.add(doc)
    await db.flush()
    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "ComplianceDoc", doc.id)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.post("/docs/{doc_id}/file")
async def upload_doc_file(doc_id: int, file: UploadFile, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(ComplianceDoc).where(ComplianceDoc.id == doc_id,
                                     ComplianceDoc.society_id == current_user.society_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    url = await save_upload(file, "compliance_docs")
    doc.file = url
    await db.commit()
    return {"file": url}


@router.patch("/docs/{doc_id}", response_model=ComplianceDocOut)
async def update_doc(doc_id: int, body: ComplianceDocCreate, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(ComplianceDoc).where(ComplianceDoc.id == doc_id,
                                     ComplianceDoc.society_id == current_user.society_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(doc, k, v)
    await log_audit(db, current_user.society_id, current_user.id, "UPDATE", "ComplianceDoc", doc.id)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.delete("/docs/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doc(doc_id: int, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(ComplianceDoc).where(ComplianceDoc.id == doc_id,
                                     ComplianceDoc.society_id == current_user.society_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    await log_audit(db, current_user.society_id, current_user.id, "DELETE", "ComplianceDoc", doc.id)
    await db.delete(doc)
    await db.commit()
