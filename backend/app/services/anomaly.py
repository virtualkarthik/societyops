from datetime import date, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.service import ServiceRecord, ServiceType

# An asset that needed REPAIR/BREAKDOWN service this many times within the
# window below is flagged as showing abnormal (anomalous) activity — e.g. a
# lamp post whose light keeps failing rather than one routine change.
ANOMALY_WINDOW_DAYS = 90
ANOMALY_THRESHOLD = 3


async def get_asset_anomalies(db: AsyncSession, society_id: int,
                               window_days: int = ANOMALY_WINDOW_DAYS,
                               threshold: int = ANOMALY_THRESHOLD) -> list[dict]:
    cutoff = date.today() - timedelta(days=window_days)

    q = (
        select(
            ServiceRecord.asset_id,
            func.count().label("event_count"),
            func.max(ServiceRecord.service_date).label("last_event_date"),
        )
        .where(
            ServiceRecord.society_id == society_id,
            ServiceRecord.service_type.in_([ServiceType.REPAIR, ServiceType.BREAKDOWN]),
            ServiceRecord.service_date >= cutoff,
        )
        .group_by(ServiceRecord.asset_id)
        .having(func.count() >= threshold)
        .order_by(func.count().desc())
    )
    rows = (await db.execute(q)).all()
    if not rows:
        return []

    asset_ids = [r.asset_id for r in rows]
    assets = {
        a.id: a for a in (await db.execute(
            select(Asset).where(Asset.id.in_(asset_ids))
        )).scalars().all()
    }

    return [
        {
            "asset_id": r.asset_id,
            "asset_name": assets[r.asset_id].name if r.asset_id in assets else f"#{r.asset_id}",
            "asset_type": assets[r.asset_id].type.value if r.asset_id in assets else None,
            "event_count": r.event_count,
            "window_days": window_days,
            "last_event_date": r.last_event_date.isoformat() if r.last_event_date else None,
        }
        for r in rows
        if r.asset_id in assets
    ]
