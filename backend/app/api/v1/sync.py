"""
Offline sync batch endpoint. Accepts an array of queued operator log entries
and upserts each by (society_id, client_uuid) — idempotent by design.
"""
from datetime import date, datetime, timezone
from typing import Any
from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.deps import CurrentUser, DB
from app.models.stp import STPLog
from app.models.water import WaterLog
from app.models.dg import DGLog
from app.models.ppm import PPMCompletion, PPMTask
from app.models.service import ServiceRecord
from app.schemas.sync import SyncItem, SyncRequest, SyncResponse, SyncResult
from app.services.ppm import calc_next_due

router = APIRouter(prefix="/sync", tags=["sync"])

_MODEL_MAP = {
    "stp_log": STPLog,
    "water_log": WaterLog,
    "dg_log": DGLog,
    "ppm_completion": PPMCompletion,
    "service_record": ServiceRecord,
}

_CONSTRAINT_MAP = {
    "stp_log": "uq_stp_log_society_uuid",
    "water_log": "uq_water_log_society_uuid",
    "dg_log": "uq_dg_log_society_uuid",
    "ppm_completion": "uq_ppm_completion_society_uuid",
    "service_record": "uq_service_record_society_uuid",
}


@router.post("/batch", response_model=SyncResponse)
async def sync_batch(body: SyncRequest, current_user: CurrentUser, db: DB):
    results: list[SyncResult] = []

    for item in body.items:
        try:
            result = await _upsert_item(item, current_user.society_id, current_user.id, db)
            results.append(result)
        except Exception as exc:
            await db.rollback()
            results.append(SyncResult(client_uuid=item.client_uuid, status="failed", error=str(exc)))

    await db.commit()
    return SyncResponse(results=results)


async def _upsert_item(item: SyncItem, society_id: int, user_id: int, db: DB) -> SyncResult:
    model = _MODEL_MAP[item.entity_type]
    constraint = _CONSTRAINT_MAP[item.entity_type]

    payload = dict(item.payload)
    payload["society_id"] = society_id
    payload["client_uuid"] = item.client_uuid

    # Coerce operator_id / completed_by to current user if not provided
    if item.entity_type in ("stp_log", "water_log", "dg_log", "service_record"):
        payload.setdefault("operator_id", user_id)
    elif item.entity_type == "ppm_completion":
        payload.setdefault("completed_by", user_id)

    # Parse datetime strings
    for field in ("logged_at", "run_start", "run_end", "completed_at"):
        if field in payload and isinstance(payload[field], str):
            payload[field] = datetime.fromisoformat(payload[field])

    # Parse date strings
    for field in ("service_date", "next_service_due"):
        if payload.get(field) and isinstance(payload[field], str):
            payload[field] = date.fromisoformat(payload[field])

    # DG auto-consume
    if item.entity_type == "dg_log":
        if payload.get("diesel_opening") and payload.get("diesel_closing") and not payload.get("diesel_consumed"):
            payload["diesel_consumed"] = payload["diesel_opening"] - payload["diesel_closing"]

    stmt = (
        pg_insert(model)
        .values(**payload)
        .on_conflict_do_update(
            constraint=constraint,
            set_={k: v for k, v in payload.items() if k not in ("id", "society_id", "client_uuid")},
        )
        .returning(model.id)
    )
    result = await db.execute(stmt)
    server_id = result.scalar_one()

    # Advance PPM next_due after completion sync
    if item.entity_type == "ppm_completion" and payload.get("task_id"):
        task_result = await db.execute(
            select(PPMTask).where(PPMTask.id == payload["task_id"], PPMTask.society_id == society_id)
        )
        task = task_result.scalar_one_or_none()
        if task:
            completed_date = payload.get("completed_at")
            if isinstance(completed_date, datetime):
                completed_date = completed_date.date()
            elif not completed_date:
                completed_date = datetime.now(timezone.utc).date()
            task.next_due = calc_next_due(task.frequency, task.custom_interval_days, completed_date)

    return SyncResult(client_uuid=item.client_uuid, status="synced", server_id=server_id)
