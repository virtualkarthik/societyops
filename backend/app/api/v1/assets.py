import io
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response, RedirectResponse
from sqlalchemy import select
import qrcode
import qrcode.image.svg

from app.core.deps import CurrentUser, DB
from app.models.asset import Asset
from app.schemas.asset import AssetCreate, AssetUpdate, AssetOut
from app.services.audit import log_audit

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[AssetOut])
async def list_assets(current_user: CurrentUser, db: DB, type: str | None = None, is_active: bool | None = None):
    q = select(Asset).where(Asset.society_id == current_user.society_id)
    if type:
        q = q.where(Asset.type == type)
    if is_active is not None:
        q = q.where(Asset.is_active == is_active)
    result = await db.execute(q.order_by(Asset.name))
    return result.scalars().all()


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def create_asset(body: AssetCreate, current_user: CurrentUser, db: DB):
    asset = Asset(society_id=current_user.society_id, **body.model_dump())
    db.add(asset)
    await db.flush()
    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "Asset", asset.id, after=body.model_dump())
    await db.commit()
    await db.refresh(asset)
    return asset


@router.get("/{asset_id}", response_model=AssetOut)
async def get_asset(asset_id: int, current_user: CurrentUser, db: DB):
    asset = await _get_or_404(asset_id, current_user.society_id, db)
    return asset


@router.patch("/{asset_id}", response_model=AssetOut)
async def update_asset(asset_id: int, body: AssetUpdate, current_user: CurrentUser, db: DB):
    asset = await _get_or_404(asset_id, current_user.society_id, db)
    before = {c.name: getattr(asset, c.name) for c in asset.__table__.columns}
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(asset, k, v)
    await log_audit(db, current_user.society_id, current_user.id, "UPDATE", "Asset", asset.id,
                    before=before, after=body.model_dump(exclude_unset=True))
    await db.commit()
    await db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(asset_id: int, current_user: CurrentUser, db: DB):
    asset = await _get_or_404(asset_id, current_user.society_id, db)
    await log_audit(db, current_user.society_id, current_user.id, "DELETE", "Asset", asset.id)
    await db.delete(asset)
    await db.commit()


@router.get("/{asset_id}/qr.png")
async def get_qr_png(asset_id: int, current_user: CurrentUser, db: DB):
    asset = await _get_or_404(asset_id, current_user.society_id, db)
    url = f"/scan/{asset.qr_token}"
    img = qrcode.make(url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


async def _get_or_404(asset_id: int, society_id: int, db: DB) -> Asset:
    result = await db.execute(select(Asset).where(Asset.id == asset_id, Asset.society_id == society_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset
