from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import CurrentUser, DB
from app.models.inventory import InventoryItem, InventoryTxn, TxnType
from app.schemas.inventory import (
    InventoryItemCreate, InventoryItemOut,
    InventoryTxnCreate, InventoryTxnOut,
)
from app.services.audit import log_audit

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/items", response_model=list[InventoryItemOut])
async def list_items(current_user: CurrentUser, db: DB, low_stock_only: bool = False):
    q = select(InventoryItem).where(InventoryItem.society_id == current_user.society_id)
    if low_stock_only:
        q = q.where(InventoryItem.current_stock <= InventoryItem.reorder_level)
    result = await db.execute(q.order_by(InventoryItem.name))
    return result.scalars().all()


@router.post("/items", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED)
async def create_item(body: InventoryItemCreate, current_user: CurrentUser, db: DB):
    item = InventoryItem(society_id=current_user.society_id, **body.model_dump())
    db.add(item)
    await db.flush()
    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "InventoryItem", item.id)
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/transactions", response_model=InventoryTxnOut, status_code=status.HTTP_201_CREATED)
async def create_transaction(body: InventoryTxnCreate, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(InventoryItem).where(InventoryItem.id == body.item_id,
                                     InventoryItem.society_id == current_user.society_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    if body.txn_type == TxnType.PURCHASE:
        item.current_stock += body.quantity
    else:
        item.current_stock -= body.quantity

    txn = InventoryTxn(society_id=current_user.society_id, **body.model_dump())
    db.add(txn)
    await db.flush()
    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "InventoryTxn", txn.id)
    await db.commit()
    await db.refresh(txn)
    return txn


@router.get("/transactions", response_model=list[InventoryTxnOut])
async def list_transactions(current_user: CurrentUser, db: DB, item_id: int | None = None):
    q = select(InventoryTxn).where(InventoryTxn.society_id == current_user.society_id)
    if item_id:
        q = q.where(InventoryTxn.item_id == item_id)
    result = await db.execute(q.order_by(InventoryTxn.txn_date.desc()))
    return result.scalars().all()
