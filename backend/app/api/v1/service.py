from fastapi import APIRouter, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.deps import CurrentUser, DB
from app.models.service import ServiceRecord
from app.schemas.service import ServiceRecordCreate, ServiceRecordOut
from app.services.audit import log_audit
from app.storage import save_upload

router = APIRouter(prefix="/service-records", tags=["service-records"])


@router.get("", response_model=list[ServiceRecordOut])
async def list_service_records(current_user: CurrentUser, db: DB, asset_id: int | None = None):
    q = select(ServiceRecord).where(ServiceRecord.society_id == current_user.society_id)
    if asset_id:
        q = q.where(ServiceRecord.asset_id == asset_id)
    result = await db.execute(q.order_by(ServiceRecord.service_date.desc()))
    return result.scalars().all()


@router.post("", response_model=ServiceRecordOut, status_code=status.HTTP_201_CREATED)
async def create_service_record(body: ServiceRecordCreate, current_user: CurrentUser, db: DB):
    data = body.model_dump()
    data["society_id"] = current_user.society_id
    data["operator_id"] = current_user.id

    if body.client_uuid:
        stmt = (
            pg_insert(ServiceRecord)
            .values(**data)
            .on_conflict_do_nothing(constraint="uq_service_record_society_uuid")
            .returning(ServiceRecord)
        )
        result = await db.execute(stmt)
        record = result.scalar_one_or_none()
        if record is None:
            existing = await db.execute(
                select(ServiceRecord).where(ServiceRecord.society_id == current_user.society_id,
                                            ServiceRecord.client_uuid == body.client_uuid)
            )
            record = existing.scalar_one()
    else:
        record = ServiceRecord(**data)
        db.add(record)
        await db.flush()

    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "ServiceRecord", record.id, after=data)
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/{record_id}/photo")
async def upload_service_photo(record_id: int, file: UploadFile, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(ServiceRecord).where(ServiceRecord.id == record_id, ServiceRecord.society_id == current_user.society_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Not found")
    url = await save_upload(file, "service")
    record.photo_url = url
    await db.commit()
    return {"photo_url": url}
