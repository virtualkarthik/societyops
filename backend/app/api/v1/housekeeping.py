from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.deps import CurrentUser, DB
from app.models.housekeeping import HousekeepingArea, HousekeepingSchedule, HousekeepingLog
from app.models.location import Block, Floor, CommonArea
from app.models.user import User
from app.schemas.housekeeping import (
    HousekeepingAreaCreate, HousekeepingAreaUpdate, HousekeepingAreaOut,
    HousekeepingScheduleCreate, HousekeepingScheduleUpdate, HousekeepingScheduleOut,
    HousekeepingLogCreate, HousekeepingLogOut,
    HousekeepingTodayOut, TodayAreaStatus, TodayActivityStatus,
)
from app.services.audit import log_audit
from app.services.housekeeping import calc_next_due

router = APIRouter(prefix="/housekeeping", tags=["housekeeping"])


# ── Areas ─────────────────────────────────────────────────────────────────
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


# ── Schedules ─────────────────────────────────────────────────────────────
@router.get("/schedules", response_model=list[HousekeepingScheduleOut])
async def list_schedules(current_user: CurrentUser, db: DB, area_id: int | None = None):
    q = select(HousekeepingSchedule).where(HousekeepingSchedule.society_id == current_user.society_id)
    if area_id:
        q = q.where(HousekeepingSchedule.area_id == area_id)
    result = await db.execute(q.order_by(HousekeepingSchedule.next_due))
    return result.scalars().all()


@router.post("/schedules", response_model=HousekeepingScheduleOut, status_code=status.HTTP_201_CREATED)
async def create_schedule(body: HousekeepingScheduleCreate, current_user: CurrentUser, db: DB):
    await _get_area_or_404(body.area_id, current_user.society_id, db)
    data = body.model_dump()
    if not data.get("next_due"):
        data["next_due"] = date.today()
    schedule = HousekeepingSchedule(society_id=current_user.society_id, **data)
    db.add(schedule)
    await db.flush()
    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "HousekeepingSchedule", schedule.id, after=data)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.patch("/schedules/{schedule_id}", response_model=HousekeepingScheduleOut)
async def update_schedule(schedule_id: int, body: HousekeepingScheduleUpdate, current_user: CurrentUser, db: DB):
    schedule = await _get_schedule_or_404(schedule_id, current_user.society_id, db)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(schedule, k, v)
    await log_audit(db, current_user.society_id, current_user.id, "UPDATE", "HousekeepingSchedule", schedule.id,
                    after=body.model_dump(exclude_unset=True))
    await db.commit()
    await db.refresh(schedule)
    return schedule


# ── Logs ──────────────────────────────────────────────────────────────────
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

    schedule_result = await db.execute(
        select(HousekeepingSchedule).where(
            HousekeepingSchedule.society_id == current_user.society_id,
            HousekeepingSchedule.area_id == body.area_id,
            HousekeepingSchedule.activity_type == body.activity_type,
        )
    )
    schedule = schedule_result.scalar_one_or_none()
    data["schedule_id"] = schedule.id if schedule else None

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

    if schedule:
        schedule.next_due = calc_next_due(schedule.frequency, schedule.custom_interval_days,
                                           body.logged_at.date())

    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "HousekeepingLog", log.id, after=data)
    await db.commit()
    await db.refresh(log)
    return log


# ── Unified "today" view ────────────────────────────────────────────────
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
    if not areas:
        return HousekeepingTodayOut(date=target_date, areas=[], total_expected=0, total_done=0)

    blocks = {b.id: b.name for b in (await db.execute(select(Block).where(Block.society_id == sid))).scalars().all()}
    floors = {f.id: f.name for f in (await db.execute(select(Floor).where(Floor.society_id == sid))).scalars().all()}
    common_areas = {c.id: c.name for c in (await db.execute(select(CommonArea).where(CommonArea.society_id == sid))).scalars().all()}

    schedules_result = await db.execute(
        select(HousekeepingSchedule)
        .where(HousekeepingSchedule.society_id == sid, HousekeepingSchedule.is_active == True)
    )
    schedules = schedules_result.scalars().all()

    day_start = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    logs_result = await db.execute(
        select(HousekeepingLog)
        .where(HousekeepingLog.society_id == sid,
               HousekeepingLog.logged_at >= day_start, HousekeepingLog.logged_at < day_end)
        .order_by(HousekeepingLog.logged_at.desc())
    )
    logs_today = logs_result.scalars().all()

    user_ids = {l.completed_by for l in logs_today if l.completed_by}
    users = {}
    if user_ids:
        users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        users = {u.id: u.name for u in users_result.scalars().all()}

    log_by_schedule: dict[int, HousekeepingLog] = {}
    for l in logs_today:
        if l.schedule_id and l.schedule_id not in log_by_schedule:
            log_by_schedule[l.schedule_id] = l

    schedules_by_area: dict[int, list[HousekeepingSchedule]] = {}
    for s in schedules:
        schedules_by_area.setdefault(s.area_id, []).append(s)

    def location_label(area: HousekeepingArea) -> str:
        if area.block_id and area.floor_id:
            return f"{blocks.get(area.block_id, '?')} — {floors.get(area.floor_id, '?')}"
        if area.block_id:
            return blocks.get(area.block_id, "?")
        if area.common_area_id:
            return common_areas.get(area.common_area_id, "?")
        return "Unassigned"

    area_statuses = []
    total_expected = 0
    total_done = 0
    for area in areas:
        activities = []
        for schedule in schedules_by_area.get(area.id, []):
            today_log = log_by_schedule.get(schedule.id)
            due = schedule.next_due <= target_date
            if not (today_log or due):
                continue
            total_expected += 1
            done = today_log is not None
            if done:
                total_done += 1
            activities.append(TodayActivityStatus(
                schedule_id=schedule.id,
                activity_type=schedule.activity_type,
                frequency=schedule.frequency,
                done=done,
                overdue=(not done) and schedule.next_due < target_date,
                logged_at=today_log.logged_at if today_log else None,
                completed_by_name=users.get(today_log.completed_by) if today_log else None,
                log_id=today_log.id if today_log else None,
                next_due=schedule.next_due,
            ))
        if not activities:
            continue
        area_statuses.append(TodayAreaStatus(
            area_id=area.id, area_name=area.name, area_type=area.area_type,
            location_label=location_label(area),
            activities=activities, all_done=all(a.done for a in activities),
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


async def _get_schedule_or_404(schedule_id: int, society_id: int, db: DB) -> HousekeepingSchedule:
    result = await db.execute(
        select(HousekeepingSchedule).where(HousekeepingSchedule.id == schedule_id, HousekeepingSchedule.society_id == society_id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule
