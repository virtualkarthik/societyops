from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.deps import CurrentUser, DB
from app.models.stp import STPLog, STPLabTest, ComplianceLimit
from app.schemas.stp import (
    STPLogCreate, STPLogOut, STPLabTestCreate, STPLabTestOut,
    ComplianceLimitOut, ComplianceLimitUpdate,
)
from app.services.audit import log_audit
from app.services.compliance import compute_removal_efficiency, check_breach
from app.storage import save_upload

router = APIRouter(prefix="/stp", tags=["stp"])


# ── STP Logs ──────────────────────────────────────────────────────────────────

@router.get("/logs", response_model=list[STPLogOut])
async def list_stp_logs(current_user: CurrentUser, db: DB,
                         asset_id: int | None = None,
                         from_date: datetime | None = None,
                         to_date: datetime | None = None):
    q = select(STPLog).where(STPLog.society_id == current_user.society_id)
    if asset_id:
        q = q.where(STPLog.asset_id == asset_id)
    if from_date:
        q = q.where(STPLog.logged_at >= from_date)
    if to_date:
        q = q.where(STPLog.logged_at <= to_date)
    result = await db.execute(q.order_by(STPLog.logged_at.desc()))
    return result.scalars().all()


@router.post("/logs", response_model=STPLogOut, status_code=status.HTTP_201_CREATED)
async def create_stp_log(body: STPLogCreate, current_user: CurrentUser, db: DB):
    data = body.model_dump()
    data["society_id"] = current_user.society_id
    data["operator_id"] = current_user.id

    if body.client_uuid:
        stmt = (
            pg_insert(STPLog)
            .values(**data)
            .on_conflict_do_nothing(constraint="uq_stp_log_society_uuid")
            .returning(STPLog)
        )
        result = await db.execute(stmt)
        log = result.scalar_one_or_none()
        if log is None:
            existing = await db.execute(
                select(STPLog).where(STPLog.society_id == current_user.society_id,
                                     STPLog.client_uuid == body.client_uuid)
            )
            log = existing.scalar_one()
    else:
        log = STPLog(**data)
        db.add(log)
        await db.flush()

    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "STPLog", log.id, after=data)
    await db.commit()
    await db.refresh(log)
    return log


@router.get("/logs/{log_id}", response_model=STPLogOut)
async def get_stp_log(log_id: int, current_user: CurrentUser, db: DB):
    result = await db.execute(select(STPLog).where(STPLog.id == log_id, STPLog.society_id == current_user.society_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Not found")
    return log


@router.post("/logs/{log_id}/photo")
async def upload_stp_photo(log_id: int, file: UploadFile, current_user: CurrentUser, db: DB):
    result = await db.execute(select(STPLog).where(STPLog.id == log_id, STPLog.society_id == current_user.society_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Not found")
    url = await save_upload(file, "stp")
    log.photo_url = url
    await db.commit()
    return {"photo_url": url}


# ── STP Lab Tests ─────────────────────────────────────────────────────────────

@router.get("/lab-tests", response_model=list[STPLabTestOut])
async def list_lab_tests(current_user: CurrentUser, db: DB, asset_id: int | None = None):
    q = select(STPLabTest).where(STPLabTest.society_id == current_user.society_id)
    if asset_id:
        q = q.where(STPLabTest.asset_id == asset_id)
    result = await db.execute(q.order_by(STPLabTest.test_date.desc()))
    return result.scalars().all()


@router.post("/lab-tests", response_model=STPLabTestOut, status_code=status.HTTP_201_CREATED)
async def create_lab_test(body: STPLabTestCreate, current_user: CurrentUser, db: DB):
    limits = await _get_limits(current_user.society_id, db)
    removal = compute_removal_efficiency(body.inlet_bod, body.outlet_bod)
    breach, breach_details = check_breach(body.outlet_bod, body.outlet_tss, body.ph, limits)

    lab = STPLabTest(
        society_id=current_user.society_id,
        removal_efficiency_bod=removal,
        breach_flag=breach,
        breach_details="; ".join(breach_details) if breach_details else None,
        **body.model_dump(),
    )
    db.add(lab)
    await db.flush()
    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "STPLabTest", lab.id)
    await db.commit()
    await db.refresh(lab)
    return lab


@router.post("/lab-tests/{test_id}/report")
async def upload_lab_report(test_id: int, file: UploadFile, current_user: CurrentUser, db: DB):
    result = await db.execute(select(STPLabTest).where(STPLabTest.id == test_id,
                                                        STPLabTest.society_id == current_user.society_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Not found")
    url = await save_upload(file, "lab_reports")
    test.report_file = url
    await db.commit()
    return {"report_file": url}


# ── Compliance Limits ─────────────────────────────────────────────────────────

@router.get("/limits", response_model=list[ComplianceLimitOut])
async def list_limits(current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(ComplianceLimit).where(ComplianceLimit.society_id == current_user.society_id)
    )
    return result.scalars().all()


@router.patch("/limits/{limit_id}", response_model=ComplianceLimitOut)
async def update_limit(limit_id: int, body: ComplianceLimitUpdate, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(ComplianceLimit).where(ComplianceLimit.id == limit_id,
                                      ComplianceLimit.society_id == current_user.society_id)
    )
    limit = result.scalar_one_or_none()
    if not limit:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(limit, k, v)
    await db.commit()
    await db.refresh(limit)
    return limit


async def _get_limits(society_id: int, db: DB) -> dict:
    result = await db.execute(select(ComplianceLimit).where(ComplianceLimit.society_id == society_id))
    rows = result.scalars().all()
    mapping = {r.parameter: r for r in rows}
    return {
        "bod_max": mapping["bod"].max_value if "bod" in mapping else 10.0,
        "tss_max": mapping["tss"].max_value if "tss" in mapping else 10.0,
        "ph_min": mapping["ph"].min_value if "ph" in mapping else 6.5,
        "ph_max": mapping["ph"].max_value if "ph" in mapping else 9.0,
    }
