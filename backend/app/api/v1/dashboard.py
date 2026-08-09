from datetime import date, timedelta
from fastapi import APIRouter
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload

from app.core.deps import CurrentUser, DB
from app.models.ppm import PPMTask
from app.models.stp import STPLabTest
from app.models.compliance import ComplianceDoc
from app.models.dg import DGLog, FuelPurchase
from app.models.complaint import Complaint, ComplaintStatus
from app.models.water import WaterLog, TankerDelivery
from app.services.anomaly import get_asset_anomalies

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
async def get_dashboard(current_user: CurrentUser, db: DB):
    sid = current_user.society_id
    today = date.today()
    thirty_days_ago = today - timedelta(days=30)
    ninety_days_out = today + timedelta(days=90)

    # Overdue PPM tasks
    overdue_result = await db.execute(
        select(PPMTask)
        .where(PPMTask.society_id == sid, PPMTask.is_active == True, PPMTask.next_due < today)
        .order_by(PPMTask.next_due.asc())
        .limit(20)
    )
    overdue_tasks = overdue_result.scalars().all()

    # STP breaches last 30 days
    breach_result = await db.execute(
        select(STPLabTest)
        .where(STPLabTest.society_id == sid, STPLabTest.breach_flag == True,
               STPLabTest.test_date >= thirty_days_ago)
        .order_by(STPLabTest.test_date.desc())
        .limit(10)
    )
    breach_tests = breach_result.scalars().all()

    # Expiring docs ≤90 days
    expiry_result = await db.execute(
        select(ComplianceDoc)
        .where(ComplianceDoc.society_id == sid,
               ComplianceDoc.expiry_date >= today,
               ComplianceDoc.expiry_date <= ninety_days_out)
        .order_by(ComplianceDoc.expiry_date.asc())
    )
    expiring_docs = expiry_result.scalars().all()

    # DG fuel stock
    fuel_purchased = (await db.execute(
        select(func.sum(FuelPurchase.litres)).where(FuelPurchase.society_id == sid)
    )).scalar() or 0
    fuel_consumed = (await db.execute(
        select(func.sum(DGLog.diesel_consumed)).where(DGLog.society_id == sid)
    )).scalar() or 0

    # Pending complaints
    pending_complaints = (await db.execute(
        select(func.count()).where(Complaint.society_id == sid, Complaint.status != ComplaintStatus.RESOLVED)
    )).scalar() or 0

    # Water balance (current month)
    month_start = today.replace(day=1)
    borewell_hours = (await db.execute(
        select(func.sum(WaterLog.borewell_run_hours))
        .where(WaterLog.society_id == sid, WaterLog.logged_at >= month_start)
    )).scalar() or 0
    tanker_litres = (await db.execute(
        select(func.sum(TankerDelivery.quantity_litres))
        .where(TankerDelivery.society_id == sid, TankerDelivery.logged_at >= month_start)
    )).scalar() or 0

    asset_anomalies = await get_asset_anomalies(db, sid)

    return {
        "overdue_ppm": {
            "count": len(overdue_tasks),
            "tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "next_due": t.next_due.isoformat() if t.next_due else None,
                    "days_overdue": (today - t.next_due).days if t.next_due else None,
                    "asset_id": t.asset_id,
                }
                for t in overdue_tasks
            ],
        },
        "stp_breaches": {
            "count": len(breach_tests),
            "tests": [
                {
                    "id": t.id,
                    "test_date": t.test_date.isoformat() if t.test_date else None,
                    "breach_details": t.breach_details,
                    "asset_id": t.asset_id,
                }
                for t in breach_tests
            ],
        },
        "expiring_docs": {
            "count": len(expiring_docs),
            "docs": [
                {
                    "id": d.id,
                    "title": d.title,
                    "doc_type": d.doc_type,
                    "expiry_date": d.expiry_date.isoformat() if d.expiry_date else None,
                    "days_until_expiry": (d.expiry_date - today).days if d.expiry_date else None,
                }
                for d in expiring_docs
            ],
        },
        "dg_fuel": {
            "estimated_stock_litres": round(fuel_purchased - fuel_consumed, 2),
            "total_purchased": round(fuel_purchased, 2),
            "total_consumed": round(fuel_consumed, 2),
        },
        "pending_complaints": pending_complaints,
        "water_this_month": {
            "borewell_run_hours": round(borewell_hours, 2),
            "tanker_litres": round(tanker_litres, 2),
        },
        "asset_anomalies": {
            "count": len(asset_anomalies),
            "items": asset_anomalies,
        },
    }
