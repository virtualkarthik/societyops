from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import CurrentUser, DB
from app.models.location import Block, Floor, CommonArea
from app.schemas.location import (
    BlockCreate, BlockUpdate, BlockOut,
    FloorCreate, FloorUpdate, FloorOut,
    CommonAreaCreate, CommonAreaUpdate, CommonAreaOut,
)
from app.services.audit import log_audit

router = APIRouter(prefix="/locations", tags=["locations"])


# ── Blocks ────────────────────────────────────────────────────────────────
@router.get("/blocks", response_model=list[BlockOut])
async def list_blocks(current_user: CurrentUser, db: DB, is_active: bool | None = None):
    q = select(Block).where(Block.society_id == current_user.society_id)
    if is_active is not None:
        q = q.where(Block.is_active == is_active)
    result = await db.execute(q.order_by(Block.name))
    return result.scalars().all()


@router.post("/blocks", response_model=BlockOut, status_code=status.HTTP_201_CREATED)
async def create_block(body: BlockCreate, current_user: CurrentUser, db: DB):
    block = Block(society_id=current_user.society_id, **body.model_dump())
    db.add(block)
    await db.flush()
    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "Block", block.id, after=body.model_dump())
    await db.commit()
    await db.refresh(block)
    return block


@router.patch("/blocks/{block_id}", response_model=BlockOut)
async def update_block(block_id: int, body: BlockUpdate, current_user: CurrentUser, db: DB):
    block = await _get_or_404(Block, block_id, current_user.society_id, db, "Block")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(block, k, v)
    await log_audit(db, current_user.society_id, current_user.id, "UPDATE", "Block", block.id,
                    after=body.model_dump(exclude_unset=True))
    await db.commit()
    await db.refresh(block)
    return block


# ── Floors ────────────────────────────────────────────────────────────────
@router.get("/floors", response_model=list[FloorOut])
async def list_floors(current_user: CurrentUser, db: DB, block_id: int | None = None, is_active: bool | None = None):
    q = select(Floor).where(Floor.society_id == current_user.society_id)
    if block_id:
        q = q.where(Floor.block_id == block_id)
    if is_active is not None:
        q = q.where(Floor.is_active == is_active)
    result = await db.execute(q.order_by(Floor.name))
    return result.scalars().all()


@router.post("/floors", response_model=FloorOut, status_code=status.HTTP_201_CREATED)
async def create_floor(body: FloorCreate, current_user: CurrentUser, db: DB):
    await _get_or_404(Block, body.block_id, current_user.society_id, db, "Block")
    floor = Floor(society_id=current_user.society_id, **body.model_dump())
    db.add(floor)
    await db.flush()
    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "Floor", floor.id, after=body.model_dump())
    await db.commit()
    await db.refresh(floor)
    return floor


@router.patch("/floors/{floor_id}", response_model=FloorOut)
async def update_floor(floor_id: int, body: FloorUpdate, current_user: CurrentUser, db: DB):
    floor = await _get_or_404(Floor, floor_id, current_user.society_id, db, "Floor")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(floor, k, v)
    await log_audit(db, current_user.society_id, current_user.id, "UPDATE", "Floor", floor.id,
                    after=body.model_dump(exclude_unset=True))
    await db.commit()
    await db.refresh(floor)
    return floor


# ── Common Areas ──────────────────────────────────────────────────────────
@router.get("/common-areas", response_model=list[CommonAreaOut])
async def list_common_areas(current_user: CurrentUser, db: DB, is_active: bool | None = None):
    q = select(CommonArea).where(CommonArea.society_id == current_user.society_id)
    if is_active is not None:
        q = q.where(CommonArea.is_active == is_active)
    result = await db.execute(q.order_by(CommonArea.name))
    return result.scalars().all()


@router.post("/common-areas", response_model=CommonAreaOut, status_code=status.HTTP_201_CREATED)
async def create_common_area(body: CommonAreaCreate, current_user: CurrentUser, db: DB):
    if body.block_id:
        await _get_or_404(Block, body.block_id, current_user.society_id, db, "Block")
    area = CommonArea(society_id=current_user.society_id, **body.model_dump())
    db.add(area)
    await db.flush()
    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "CommonArea", area.id, after=body.model_dump())
    await db.commit()
    await db.refresh(area)
    return area


@router.patch("/common-areas/{area_id}", response_model=CommonAreaOut)
async def update_common_area(area_id: int, body: CommonAreaUpdate, current_user: CurrentUser, db: DB):
    area = await _get_or_404(CommonArea, area_id, current_user.society_id, db, "CommonArea")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(area, k, v)
    await log_audit(db, current_user.society_id, current_user.id, "UPDATE", "CommonArea", area.id,
                    after=body.model_dump(exclude_unset=True))
    await db.commit()
    await db.refresh(area)
    return area


async def _get_or_404(model, obj_id: int, society_id: int, db: DB, label: str):
    result = await db.execute(select(model).where(model.id == obj_id, model.society_id == society_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return obj
