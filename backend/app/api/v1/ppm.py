from datetime import date, datetime, timezone
from fastapi import APIRouter, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.deps import CurrentUser, DB
from app.models.ppm import PPMTask, PPMCompletion
from app.schemas.ppm import (
    PPMTaskCreate, PPMTaskUpdate, PPMTaskOut,
    PPMCompletionCreate, PPMCompletionOut,
)
from app.services.audit import log_audit
from app.services.ppm import calc_next_due
from app.storage import save_upload

router = APIRouter(prefix="/ppm", tags=["ppm"])


@router.get("/tasks", response_model=list[PPMTaskOut])
async def list_tasks(current_user: CurrentUser, db: DB,
                      overdue_only: bool = False, asset_id: int | None = None):
    q = select(PPMTask).where(PPMTask.society_id == current_user.society_id, PPMTask.is_active == True)
    if asset_id:
        q = q.where(PPMTask.asset_id == asset_id)
    if overdue_only:
        q = q.where(PPMTask.next_due < date.today())
    result = await db.execute(q.order_by(PPMTask.next_due.asc()))
    return result.scalars().all()


@router.post("/tasks", response_model=PPMTaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(body: PPMTaskCreate, current_user: CurrentUser, db: DB):
    data = body.model_dump()
    if not data.get("next_due"):
        data["next_due"] = calc_next_due(body.frequency, body.custom_interval_days, date.today())
    task = PPMTask(society_id=current_user.society_id, **data)
    db.add(task)
    await db.flush()
    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "PPMTask", task.id, after=data)
    await db.commit()
    await db.refresh(task)
    return task


@router.get("/tasks/{task_id}", response_model=PPMTaskOut)
async def get_task(task_id: int, current_user: CurrentUser, db: DB):
    task = await _get_task_or_404(task_id, current_user.society_id, db)
    return task


@router.patch("/tasks/{task_id}", response_model=PPMTaskOut)
async def update_task(task_id: int, body: PPMTaskUpdate, current_user: CurrentUser, db: DB):
    task = await _get_task_or_404(task_id, current_user.society_id, db)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(task, k, v)
    await log_audit(db, current_user.society_id, current_user.id, "UPDATE", "PPMTask", task.id,
                    after=body.model_dump(exclude_unset=True))
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_task(task_id: int, current_user: CurrentUser, db: DB):
    task = await _get_task_or_404(task_id, current_user.society_id, db)
    task.is_active = False
    await log_audit(db, current_user.society_id, current_user.id, "DELETE", "PPMTask", task.id)
    await db.commit()


@router.get("/completions", response_model=list[PPMCompletionOut])
async def list_completions(current_user: CurrentUser, db: DB, task_id: int | None = None):
    q = select(PPMCompletion).where(PPMCompletion.society_id == current_user.society_id)
    if task_id:
        q = q.where(PPMCompletion.task_id == task_id)
    result = await db.execute(q.order_by(PPMCompletion.completed_at.desc()))
    return result.scalars().all()


@router.post("/completions", response_model=PPMCompletionOut, status_code=status.HTTP_201_CREATED)
async def create_completion(body: PPMCompletionCreate, current_user: CurrentUser, db: DB):
    data = body.model_dump()
    data["society_id"] = current_user.society_id
    data["completed_by"] = current_user.id

    if body.client_uuid:
        stmt = (
            pg_insert(PPMCompletion)
            .values(**data)
            .on_conflict_do_nothing(constraint="uq_ppm_completion_society_uuid")
            .returning(PPMCompletion)
        )
        result = await db.execute(stmt)
        completion = result.scalar_one_or_none()
        if completion is None:
            existing = await db.execute(
                select(PPMCompletion).where(PPMCompletion.society_id == current_user.society_id,
                                            PPMCompletion.client_uuid == body.client_uuid)
            )
            completion = existing.scalar_one()
    else:
        completion = PPMCompletion(**data)
        db.add(completion)
        await db.flush()

    # Advance next_due on the task
    task = await _get_task_or_404(body.task_id, current_user.society_id, db)
    task.next_due = calc_next_due(task.frequency, task.custom_interval_days,
                                   body.completed_at.date() if body.completed_at else date.today())

    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "PPMCompletion", completion.id)
    await db.commit()
    await db.refresh(completion)
    return completion


@router.post("/completions/{completion_id}/photos")
async def upload_proof_photo(completion_id: int, file: UploadFile, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(PPMCompletion).where(PPMCompletion.id == completion_id,
                                    PPMCompletion.society_id == current_user.society_id)
    )
    completion = result.scalar_one_or_none()
    if not completion:
        raise HTTPException(status_code=404, detail="Not found")
    url = await save_upload(file, "ppm_photos")
    photos = list(completion.proof_photos_json or [])
    photos.append(url)
    completion.proof_photos_json = photos
    await db.commit()
    return {"photo_url": url, "all_photos": photos}


async def _get_task_or_404(task_id: int, society_id: int, db: DB) -> PPMTask:
    result = await db.execute(
        select(PPMTask).where(PPMTask.id == task_id, PPMTask.society_id == society_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
