from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.deps import CurrentUser, DB
from app.models.housekeeping import HousekeepingArea, HousekeepingLog
from app.models.user import User
from app.schemas.housekeeping import (
    HousekeepingAreaCreate, HousekeepingAreaUpdate, HousekeepingAreaOut,
    HousekeepingLogCreate, HousekeepingLogOut,
    HousekeepingTodayOut, TodayAreaStatus, TodayActivityStatus,
)
from app.services.audit import log_audit

router = APIRouter(prefix="/housekeeping", tags=["housekeeping"])


@router.get("/areas", response_model=list[HousekeepingAreaOut])
async def list_areas(current_user: CurrentUser, db: DB, is_active: bool | None = None):
    q = select(HousekeepingArea).where(HousekeepingArea.society_id == current_user.society_id)
    if is_active is not None:
        q = q.where(HousekeepingArea.is_active == is_active)
    result = await db.execute(q.order_by(HousekeepingArea.name))
    return result.scalars().all()


@router.post("/areas", response_model=HousekeepingAreaOut, status_code=status.HTTP_201_CREATED)
async def create_area(body: HousekeepingAreaCreate, current_user: CurrentUser, db: DB):
    data = body.model_dump()
    area = HousekeepingArea(society_id=current_user.society_id, **data)
    db.add(area)
    await db.flush()
    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "HousekeepingArea", area.id, after=data)
    await db.commit()
    await db.refresh(area)
    return area


@router.patch("/areas/{area_id}", response_model=HousekeepingAreaOut)
async def update_area(area_id: int, body: HousekeepingAreaUpdate, current_user: CurrentUser, db: DB):
    area = await _get_area_or_404(area_id, current_user.society_id, db)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(area, k, v)
    await log_audit(db, current_user.society_id, current_user.id, "UPDATE", "HousekeepingArea", area.id,
                    after=body.model_dump(exclude_unset=True))
    await db.commit()
    await db.refresh(area)
    return area


@router.get("/logs", response_model=list[HousekeepingLogOut])
async def list_logs(current_user: CurrentUser, db: DB, area_id: int | None = None,
                     date_from: date | None = None, date_to: date | None = None):
    q = select(HousekeepingLog).where(HousekeepingLog.society_id == current_user.society_id)
    if area_id:
        q = q.where(HousekeepingLog.area_id == area_id)
    if date_from:
        q = q.where(HousekeepingLog.logged_at >= datetime.combine(date_from, datetime.min.time(), tzinfo=timezone.utc))
    if date_to:
        q = q.where(HousekeepingLog.logged_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc))
    result = await db.execute(q.order_by(HousekeepingLog.logged_at.desc()).limit(200))
    return result.scalars().all()


@router.post("/logs", response_model=HousekeepingLogOut, status_code=status.HTTP_201_CREATED)
async def create_log(body: HousekeepingLogCreate, current_user: CurrentUser, db: DB):
    data = body.model_dump()
    data["society_id"] = current_user.society_id
    data["completed_by"] = current_user.id

    if body.client_uuid:
        stmt = (
            pg_insert(HousekeepingLog)
            .values(**data)
            .on_conflict_do_nothing(constraint="uq_housekeeping_log_society_uuid")
            .returning(HousekeepingLog)
        )
        result = await db.execute(stmt)
        log = result.scalar_one_or_none()
        if log is None:
            existing = await db.execute(
                select(HousekeepingLog).where(HousekeepingLog.society_id == current_user.society_id,
                                               HousekeepingLog.client_uuid == body.client_uuid)
            )
            log = existing.scalar_one()
    else:
        log = HousekeepingLog(**data)
        db.add(log)
        await db.flush()

    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "HousekeepingLog", log.id, after=data)
    await db.commit()
    await db.refresh(log)
    return log


@router.get("/today", response_model=HousekeepingTodayOut)
async def get_today_status(current_user: CurrentUser, db: DB, for_date: date | None = None):
    target_date = for_date or date.today()
    sid = current_user.society_id

    areas_result = await db.execute(
        select(HousekeepingArea)
        .where(HousekeepingArea.society_id == sid, HousekeepingArea.is_active == True)
        .order_by(HousekeepingArea.name)
    )
    areas = areas_result.scalars().all()

    day_start = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    logs_result = await db.execute(
        select(HousekeepingLog)
        .where(HousekeepingLog.society_id == sid,
               HousekeepingLog.logged_at >= day_start, HousekeepingLog.logged_at < day_end)
        .order_by(HousekeepingLog.logged_at.desc())
    )
    logs = logs_result.scalars().all()

    user_ids = {l.completed_by for l in logs if l.completed_by}
    users = {}
    if user_ids:
        users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        users = {u.id: u.name for u in users_result.scalars().all()}

    # Most recent log per (area_id, activity_type) for the day
    latest_by_key: dict[tuple[int, str], HousekeepingLog] = {}
    for l in logs:
        key = (l.area_id, l.activity_type.value)
        if key not in latest_by_key:
            latest_by_key[key] = l

    area_statuses = []
    total_expected = 0
    total_done = 0
    for area in areas:
        expected = area.expected_activities or []
        activities = []
        for activity in expected:
            total_expected += 1
            log = latest_by_key.get((area.id, activity))
            done = log is not None
            if done:
                total_done += 1
            activities.append(TodayActivityStatus(
                activity_type=activity,
                done=done,
                logged_at=log.logged_at if log else None,
                completed_by_name=users.get(log.completed_by) if log else None,
                log_id=log.id if log else None,
            ))
        area_statuses.append(TodayAreaStatus(
            area_id=area.id, area_name=area.name, area_type=area.area_type,
            activities=activities, all_done=all(a.done for a in activities) if activities else True,
        ))

    return HousekeepingTodayOut(date=target_date, areas=area_statuses,
                                 total_expected=total_expected, total_done=total_done)


async def _get_area_or_404(area_id: int, society_id: int, db: DB) -> HousekeepingArea:
    result = await db.execute(
        select(HousekeepingArea).where(HousekeepingArea.id == area_id, HousekeepingArea.society_id == society_id)
    )
    area = result.scalar_one_or_none()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")
    return area
