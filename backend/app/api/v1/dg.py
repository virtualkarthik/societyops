from fastapi import APIRouter, HTTPException, UploadFile, status
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.deps import CurrentUser, DB
from app.models.dg import DGLog, FuelPurchase
from app.schemas.dg import DGLogCreate, DGLogOut, FuelPurchaseCreate, FuelPurchaseOut
from app.services.audit import log_audit
from app.storage import save_upload

router = APIRouter(prefix="/dg", tags=["dg"])


@router.get("/logs", response_model=list[DGLogOut])
async def list_dg_logs(current_user: CurrentUser, db: DB, asset_id: int | None = None):
    q = select(DGLog).where(DGLog.society_id == current_user.society_id)
    if asset_id:
        q = q.where(DGLog.asset_id == asset_id)
    result = await db.execute(q.order_by(DGLog.run_start.desc()))
    return result.scalars().all()


@router.post("/logs", response_model=DGLogOut, status_code=status.HTTP_201_CREATED)
async def create_dg_log(body: DGLogCreate, current_user: CurrentUser, db: DB):
    data = body.model_dump()
    data["society_id"] = current_user.society_id
    data["operator_id"] = current_user.id

    # Auto-compute diesel_consumed if not provided
    if data.get("diesel_opening") is not None and data.get("diesel_closing") is not None and data.get("diesel_consumed") is None:
        data["diesel_consumed"] = data["diesel_opening"] - data["diesel_closing"]

    if body.client_uuid:
        stmt = (
            pg_insert(DGLog)
            .values(**data)
            .on_conflict_do_nothing(constraint="uq_dg_log_society_uuid")
            .returning(DGLog)
        )
        result = await db.execute(stmt)
        log = result.scalar_one_or_none()
        if log is None:
            existing = await db.execute(
                select(DGLog).where(DGLog.society_id == current_user.society_id,
                                    DGLog.client_uuid == body.client_uuid)
            )
            log = existing.scalar_one()
    else:
        log = DGLog(**data)
        db.add(log)
        await db.flush()

    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "DGLog", log.id, after=data)
    await db.commit()
    await db.refresh(log)
    return log


@router.post("/logs/{log_id}/photo")
async def upload_dg_photo(log_id: int, file: UploadFile, current_user: CurrentUser, db: DB):
    result = await db.execute(select(DGLog).where(DGLog.id == log_id, DGLog.society_id == current_user.society_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Not found")
    url = await save_upload(file, "dg")
    log.photo_url = url
    await db.commit()
    return {"photo_url": url}


@router.get("/fuel-purchases", response_model=list[FuelPurchaseOut])
async def list_fuel_purchases(current_user: CurrentUser, db: DB, asset_id: int | None = None):
    q = select(FuelPurchase).where(FuelPurchase.society_id == current_user.society_id)
    if asset_id:
        q = q.where(FuelPurchase.asset_id == asset_id)
    result = await db.execute(q.order_by(FuelPurchase.purchase_date.desc()))
    return result.scalars().all()


@router.post("/fuel-purchases", response_model=FuelPurchaseOut, status_code=status.HTTP_201_CREATED)
async def create_fuel_purchase(body: FuelPurchaseCreate, current_user: CurrentUser, db: DB):
    purchase = FuelPurchase(society_id=current_user.society_id, **body.model_dump())
    db.add(purchase)
    await db.flush()
    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "FuelPurchase", purchase.id)
    await db.commit()
    await db.refresh(purchase)
    return purchase


@router.get("/fuel-reconciliation")
async def fuel_reconciliation(current_user: CurrentUser, db: DB, asset_id: int | None = None):
    """Total purchased vs consumed vs estimated current stock."""
    purchased_q = select(func.sum(FuelPurchase.litres)).where(FuelPurchase.society_id == current_user.society_id)
    consumed_q = select(func.sum(DGLog.diesel_consumed)).where(DGLog.society_id == current_user.society_id)
    if asset_id:
        purchased_q = purchased_q.where(FuelPurchase.asset_id == asset_id)
        consumed_q = consumed_q.where(DGLog.asset_id == asset_id)
    purchased = (await db.execute(purchased_q)).scalar() or 0
    consumed = (await db.execute(consumed_q)).scalar() or 0
    return {
        "total_purchased_litres": round(purchased, 2),
        "total_consumed_litres": round(consumed, 2),
        "estimated_stock_litres": round(purchased - consumed, 2),
    }
