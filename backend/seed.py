"""
Seed script: creates one society, 4 users, 8 assets, 10 PPM tasks,
compliance limits, 30 days of operational logs, and 5 compliance docs.
"""
import os
import sys
import secrets
from datetime import date, datetime, timedelta, timezone

# Ensure app is importable
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.models.society import Society
from app.models.user import User, UserRole
from app.models.asset import Asset, AssetType
from app.models.stp import STPLog, STPLabTest, ComplianceLimit, Shift
from app.models.water import WaterLog, TankerDelivery
from app.models.dg import DGLog, FuelPurchase
from app.models.ppm import PPMTask, PPMFrequency
from app.models.compliance import ComplianceDoc

engine = create_engine(settings.DATABASE_URL_SYNC)

with Session(engine) as session:
    # Wipe existing seed data (idempotent)
    session.query(ComplianceDoc).delete()
    session.query(STPLabTest).delete()
    session.query(STPLog).delete()
    session.query(WaterLog).delete()
    session.query(TankerDelivery).delete()
    session.query(DGLog).delete()
    session.query(FuelPurchase).delete()
    session.query(PPMTask).delete()
    session.query(ComplianceLimit).delete()
    session.query(Asset).delete()
    session.query(User).delete()
    session.query(Society).delete()
    session.commit()

    # ── Society ────────────────────────────────────────────────────────────────
    society = Society(
        name="Sunrise Apartments",
        address="No. 12, Anna Nagar, Chennai - 600040, Tamil Nadu",
        builtup_area_sqm=4200.0,
        cto_number="TNPCB/CTO/CHN/2022/001234",
        cto_expiry=date.today() + timedelta(days=180),
        contact_email="committee@sunriseapts.in",
        contact_phone="+91-44-12345678",
    )
    session.add(society)
    session.flush()
    sid = society.id

    # ── Users ──────────────────────────────────────────────────────────────────
    users = [
        User(society_id=sid, name="Admin Kumar", email="admin@sunriseapts.in",
             phone="+91-9876543210", role=UserRole.super_admin,
             password_hash=hash_password("admin123")),
        User(society_id=sid, name="Priya Committee", email="committee@sunriseapts.in",
             phone="+91-9876543211", role=UserRole.committee,
             password_hash=hash_password("committee123")),
        User(society_id=sid, name="Rajan Operator", email="operator@sunriseapts.in",
             phone="+91-9876543212", role=UserRole.operator,
             password_hash=hash_password("operator123")),
        User(society_id=sid, name="Meena Resident", email="resident@sunriseapts.in",
             phone="+91-9876543213", role=UserRole.resident,
             password_hash=hash_password("resident123")),
    ]
    for u in users:
        session.add(u)
    session.flush()
    operator = users[2]

    # ── Assets ─────────────────────────────────────────────────────────────────
    assets_data = [
        dict(type=AssetType.STP, name="STP Unit 1", make="Enviro Tech", model="ET-50KLD",
             capacity_value=50, capacity_unit="KLD",
             install_date=date(2019, 6, 1), amc_vendor="Enviro Tech Services",
             amc_expiry=date.today() + timedelta(days=90), location="Basement B1"),
        dict(type=AssetType.BOREWELL, name="Borewell BW-1", make="Grundfos", model="CM3-5",
             capacity_value=5000, capacity_unit="LPH",
             install_date=date(2018, 3, 15), location="North Corner"),
        dict(type=AssetType.BOREWELL, name="Borewell BW-2", make="Grundfos", model="CM3-5",
             capacity_value=5000, capacity_unit="LPH",
             install_date=date(2018, 3, 15), location="South Corner"),
        dict(type=AssetType.SUMP, name="Underground Sump", capacity_value=100000, capacity_unit="L",
             location="Basement B2"),
        dict(type=AssetType.OHT, name="Overhead Tank OHT-1", capacity_value=50000, capacity_unit="L",
             location="Terrace Block A"),
        dict(type=AssetType.DG, name="DG Set DG-1", make="Kirloskar", model="KG2-125WS",
             capacity_value=125, capacity_unit="kVA",
             install_date=date(2020, 1, 10), amc_vendor="Kirloskar Services",
             amc_expiry=date.today() + timedelta(days=60), location="Generator Room"),
        dict(type=AssetType.LIFT, name="Lift Block A", make="OTIS", model="Gen2",
             install_date=date(2017, 8, 1), amc_vendor="OTIS Elevator Co",
             amc_expiry=date.today() + timedelta(days=30), location="Block A"),
        dict(type=AssetType.FIRE, name="Fire Panel FP-1", make="Honeywell",
             install_date=date(2019, 1, 1), amc_vendor="Honeywell Fire",
             amc_expiry=date.today() + timedelta(days=45), location="Ground Floor Lobby"),
    ]
    assets = []
    for ad in assets_data:
        a = Asset(society_id=sid, qr_token=secrets.token_urlsafe(16), is_active=True, **ad)
        session.add(a)
        assets.append(a)
    session.flush()

    stp_asset = assets[0]
    borewell_1 = assets[1]
    dg_asset = assets[5]

    # ── Compliance Limits ──────────────────────────────────────────────────────
    limits = [
        ComplianceLimit(society_id=sid, parameter="bod", max_value=10.0, unit="mg/L",
                         description="TNPCB BOD outlet limit"),
        ComplianceLimit(society_id=sid, parameter="tss", max_value=10.0, unit="mg/L",
                         description="TNPCB TSS outlet limit"),
        ComplianceLimit(society_id=sid, parameter="ph", min_value=6.5, max_value=9.0,
                         description="TNPCB pH acceptable range"),
        ComplianceLimit(society_id=sid, parameter="cod", max_value=50.0, unit="mg/L",
                         description="CPCB COD outlet limit"),
    ]
    for lim in limits:
        session.add(lim)

    # ── PPM Tasks (10 statutory) ───────────────────────────────────────────────
    today = date.today()
    ppm_tasks = [
        PPMTask(society_id=sid, asset_id=assets[6].id, title="Lift AMC Service",
                category="Lift", frequency=PPMFrequency.MONTHLY, is_statutory=True,
                next_due=today + timedelta(days=5), escalate_after_days=3,
                checklist_json=["Check door sensors", "Test emergency stop", "Lubricate cables", "Log meter reading"]),
        PPMTask(society_id=sid, asset_id=assets[7].id, title="Fire NOC Renewal",
                category="Fire Safety", frequency=PPMFrequency.YEARLY, is_statutory=True,
                next_due=today + timedelta(days=60), escalate_after_days=30,
                checklist_json=["Submit application", "Inspection passed", "NOC received"]),
        PPMTask(society_id=sid, asset_id=assets[7].id, title="Fire Extinguisher Refill",
                category="Fire Safety", frequency=PPMFrequency.YEARLY, is_statutory=True,
                next_due=today + timedelta(days=45),
                checklist_json=["Check pressure gauge", "Weigh cylinder", "Refill if needed", "Affix new tag"]),
        PPMTask(society_id=sid, asset_id=stp_asset.id, title="Water Tank Cleaning",
                category="STP/Water", frequency=PPMFrequency.HALFYEARLY, is_statutory=True,
                next_due=today + timedelta(days=90),
                checklist_json=["Drain tank", "Scrub walls", "Disinfect", "Refill and test"]),
        PPMTask(society_id=sid, title="Pest Control",
                category="Housekeeping", frequency=PPMFrequency.QUARTERLY, is_statutory=False,
                next_due=today + timedelta(days=15),
                checklist_json=["Common areas", "Basement", "Terrace", "Sewage room"]),
        PPMTask(society_id=sid, asset_id=dg_asset.id, title="DG Set Service",
                category="DG", frequency=PPMFrequency.HALFYEARLY, is_statutory=False,
                next_due=today - timedelta(days=2),  # intentionally overdue for demo
                escalate_after_days=5,
                checklist_json=["Oil change", "Air filter", "Battery check", "Load test", "Fuel top-up"]),
        PPMTask(society_id=sid, asset_id=stp_asset.id, title="STP Quarterly Lab Test",
                category="STP/Compliance", frequency=PPMFrequency.QUARTERLY, is_statutory=True,
                next_due=today + timedelta(days=20),
                checklist_json=["Collect inlet & outlet samples", "Submit to TNPCB-approved lab", "Upload report"]),
        PPMTask(society_id=sid, title="TNPCB CTO Renewal",
                category="Statutory", frequency=PPMFrequency.YEARLY, is_statutory=True,
                next_due=today + timedelta(days=150),
                checklist_json=["Prepare documents", "Submit online application", "Pay fees", "Inspection", "CTO received"]),
        PPMTask(society_id=sid, title="Transformer Maintenance",
                category="Electrical", frequency=PPMFrequency.YEARLY, is_statutory=True,
                next_due=today + timedelta(days=200),
                checklist_json=["Oil level check", "Silica gel inspection", "Bushing check", "Earthing test"]),
        PPMTask(society_id=sid, title="EB Safety Certificate",
                category="Electrical", frequency=PPMFrequency.YEARLY, is_statutory=True,
                next_due=today - timedelta(days=5),  # overdue
                escalate_after_days=7,
                checklist_json=["Apply to TANGEDCO", "Electrical audit", "Certificate issued"]),
    ]
    for task in ppm_tasks:
        session.add(task)

    # ── 30 Days of STP Logs ────────────────────────────────────────────────────
    import random
    random.seed(42)
    for i in range(30):
        log_date = datetime.now(timezone.utc) - timedelta(days=i)
        log = STPLog(
            society_id=sid, asset_id=stp_asset.id,
            logged_at=log_date, shift=Shift.AM if i % 2 == 0 else Shift.PM,
            ph=round(random.uniform(6.8, 8.2), 1),
            mlss=round(random.uniform(2000, 4000), 0),
            chlorine_dosing=round(random.uniform(0.5, 2.0), 1),
            blower_run_hours=round(random.uniform(20, 24), 1),
            inlet_flow=round(random.uniform(40, 55), 1),
            outlet_flow=round(random.uniform(38, 52), 1),
            tank_level=round(random.uniform(60, 90), 0),
            backwash_done=(i % 7 == 0),
            sludge_removed=(i % 14 == 0),
            power_hours=round(random.uniform(20, 24), 1),
            operator_id=operator.id,
        )
        session.add(log)

    # ── Lab Tests ──────────────────────────────────────────────────────────────
    lab_tests = [
        STPLabTest(society_id=sid, asset_id=stp_asset.id,
                   test_date=datetime.now(timezone.utc) - timedelta(days=90),
                   lab_name="EnviroTest Labs Chennai", inlet_bod=185.0, outlet_bod=8.5,
                   inlet_tss=220.0, outlet_tss=7.2, ph=7.1,
                   removal_efficiency_bod=95.41, breach_flag=False),
        STPLabTest(society_id=sid, asset_id=stp_asset.id,
                   test_date=datetime.now(timezone.utc) - timedelta(days=5),
                   lab_name="EnviroTest Labs Chennai", inlet_bod=178.0, outlet_bod=12.3,
                   inlet_tss=210.0, outlet_tss=9.8, ph=7.4,
                   removal_efficiency_bod=93.09, breach_flag=True,
                   breach_details="BOD 12.3 mg/L exceeds limit 10.0 mg/L"),
    ]
    for lt in lab_tests:
        session.add(lt)

    # ── Water Logs ─────────────────────────────────────────────────────────────
    for i in range(30):
        log_date = datetime.now(timezone.utc) - timedelta(days=i)
        wl = WaterLog(
            society_id=sid, asset_id=borewell_1.id,
            logged_at=log_date,
            borewell_run_hours=round(random.uniform(8, 16), 1),
            water_level=round(random.uniform(15, 35), 1),
            sump_level=round(random.uniform(50, 90), 0),
            oht_level=round(random.uniform(40, 95), 0),
            operator_id=operator.id,
        )
        session.add(wl)

    # Tanker deliveries (3 this month)
    for i in [5, 12, 20]:
        td = TankerDelivery(
            society_id=sid, logged_at=datetime.now(timezone.utc) - timedelta(days=i),
            quantity_litres=5000, cost=1500.0, vendor="Chennai Water Tankers",
            operator_id=operator.id,
        )
        session.add(td)

    # ── DG Logs ────────────────────────────────────────────────────────────────
    for i in range(10):
        start = datetime.now(timezone.utc) - timedelta(days=i * 3)
        run_hrs = round(random.uniform(2, 8), 1)
        consumed = round(run_hrs * 12.5, 1)
        dgl = DGLog(
            society_id=sid, asset_id=dg_asset.id,
            run_start=start, run_end=start + timedelta(hours=run_hrs),
            run_hours=run_hrs,
            diesel_opening=round(random.uniform(150, 300), 1),
            diesel_closing=lambda: 0,  # computed below
            diesel_consumed=consumed,
            load_kw=round(random.uniform(60, 100), 1),
            frequency=50.0, voltage=415.0,
            operator_id=operator.id,
        )
        dgl.diesel_closing = dgl.diesel_opening - consumed
        session.add(dgl)

    # Fuel purchases
    for i, litres in [(2, 200), (15, 150), (28, 200)]:
        fp = FuelPurchase(
            society_id=sid, asset_id=dg_asset.id,
            purchase_date=date.today() - timedelta(days=i),
            litres=litres, cost=litres * 95.0, vendor="Indian Oil, Anna Nagar",
        )
        session.add(fp)

    # ── Compliance Docs ────────────────────────────────────────────────────────
    docs = [
        ComplianceDoc(society_id=sid, doc_type="CTO", title="TNPCB Consent to Operate",
                       issue_date=date.today() - timedelta(days=185),
                       expiry_date=date.today() + timedelta(days=180)),
        ComplianceDoc(society_id=sid, doc_type="FIRE_NOC", title="Fire NOC - Block A",
                       issue_date=date.today() - timedelta(days=300),
                       expiry_date=date.today() + timedelta(days=65)),
        ComplianceDoc(society_id=sid, doc_type="LIFT_LICENSE", title="Lift Operating License",
                       issue_date=date.today() - timedelta(days=200),
                       expiry_date=date.today() + timedelta(days=25)),
        ComplianceDoc(society_id=sid, doc_type="EB_SAFETY", title="EB Safety Certificate",
                       issue_date=date.today() - timedelta(days=400),
                       expiry_date=date.today() - timedelta(days=5)),  # expired
        ComplianceDoc(society_id=sid, doc_type="WATER_ANALYSIS", title="Potable Water Analysis Report",
                       issue_date=date.today() - timedelta(days=30),
                       expiry_date=date.today() + timedelta(days=335)),
    ]
    for doc in docs:
        session.add(doc)

    session.commit()
    print("✓ Seed complete!")
    print(f"  Society: {society.name} (id={society.id})")
    print(f"  Users: admin@sunriseapts.in / committee@sunriseapts.in / operator@sunriseapts.in / resident@sunriseapts.in")
    print(f"  Passwords: admin123 / committee123 / operator123 / resident123")
    print(f"  Assets: {len(assets)}, PPM Tasks: {len(ppm_tasks)}")
