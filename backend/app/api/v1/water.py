from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, status
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.deps import CurrentUser, DB
from app.models.water import WaterLog, TankerDelivery
from app.schemas.water import WaterLogCreate, WaterLogOut, TankerDeliveryCreate, TankerDeliveryOut
from app.services.audit import log_audit
from app.storage import save_upload

router = APIRouter(prefix="/water", tags=["water"])


@router.get("/logs", response_model=list[WaterLogOut])
async def list_water_logs(current_user: CurrentUser, db: DB,
                           asset_id: int | None = None,
                           from_date: datetime | None = None,
                           to_date: datetime | None = None):
    q = select(WaterLog).where(WaterLog.society_id == current_user.society_id)
    if asset_id:
        q = q.where(WaterLog.asset_id == asset_id)
    if from_date:
        q = q.where(WaterLog.logged_at >= from_date)
    if to_date:
        q = q.where(WaterLog.logged_at <= to_date)
    result = await db.execute(q.order_by(WaterLog.logged_at.desc()))
    return result.scalars().all()


@router.post("/logs", response_model=WaterLogOut, status_code=status.HTTP_201_CREATED)
async def create_water_log(body: WaterLogCreate, current_user: CurrentUser, db: DB):
    data = body.model_dump()
    data["society_id"] = current_user.society_id
    data["operator_id"] = current_user.id

    if body.client_uuid:
        stmt = (
            pg_insert(WaterLog)
            .values(**data)
            .on_conflict_do_nothing(constraint="uq_water_log_society_uuid")
            .returning(WaterLog)
        )
        result = await db.execute(stmt)
        log = result.scalar_one_or_none()
        if log is None:
            existing = await db.execute(
                select(WaterLog).where(WaterLog.society_id == current_user.society_id,
                                       WaterLog.client_uuid == body.client_uuid)
            )
            log = existing.scalar_one()
    else:
        log = WaterLog(**data)
        db.add(log)
        await db.flush()

    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "WaterLog", log.id, after=data)
    await db.commit()
    await db.refresh(log)
    return log


@router.post("/logs/{log_id}/photo")
async def upload_water_photo(log_id: int, file: UploadFile, current_user: CurrentUser, db: DB):
    result = await db.execute(select(WaterLog).where(WaterLog.id == log_id,
                                                      WaterLog.society_id == current_user.society_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Not found")
    url = await save_upload(file, "water")
    log.photo_url = url
    await db.commit()
    return {"photo_url": url}


@router.get("/tankers", response_model=list[TankerDeliveryOut])
async def list_tankers(current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(TankerDelivery).where(TankerDelivery.society_id == current_user.society_id)
        .order_by(TankerDelivery.logged_at.desc())
    )
    return result.scalars().all()


@router.post("/tankers", response_model=TankerDeliveryOut, status_code=status.HTTP_201_CREATED)
async def create_tanker(body: TankerDeliveryCreate, current_user: CurrentUser, db: DB):
    delivery = TankerDelivery(society_id=current_user.society_id,
                               operator_id=current_user.id,
                               **body.model_dump())
    db.add(delivery)
    await db.flush()
    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "TankerDelivery", delivery.id)
    await db.commit()
    await db.refresh(delivery)
    return delivery


@router.get("/balance")
async def water_balance(current_user: CurrentUser, db: DB):
    """Monthly water sources vs consumption summary."""
    borewell_result = await db.execute(
        select(func.sum(WaterLog.borewell_run_hours))
        .where(WaterLog.society_id == current_user.society_id)
    )
    tanker_result = await db.execute(
        select(func.sum(TankerDelivery.quantity_litres))
        .where(TankerDelivery.society_id == current_user.society_id)
    )
    return {
        "total_borewell_run_hours": borewell_result.scalar() or 0,
        "total_tanker_litres": tanker_result.scalar() or 0,
    }
