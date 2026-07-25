"""
Server-side PDF report generation using reportlab.
All reports branded with "SocietyOps" header/footer.
"""
import io
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER

from app.core.deps import CurrentUser, DB
from app.models.society import Society
from app.models.stp import STPLog, STPLabTest
from app.models.ppm import PPMTask
from app.models.compliance import ComplianceDoc
from app.models.audit import AuditEntry

router = APIRouter(prefix="/reports", tags=["reports"])

BRAND_BLUE = colors.HexColor("#1e40af")
BRAND_LIGHT = colors.HexColor("#dbeafe")


def _build_doc(title: str) -> tuple[io.BytesIO, SimpleDocTemplate]:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=2 * cm, bottomMargin=2 * cm,
        leftMargin=2 * cm, rightMargin=2 * cm,
        title=title,
    )
    return buf, doc


def _header_footer(canvas, doc):
    canvas.saveState()
    # Header
    canvas.setFillColor(BRAND_BLUE)
    canvas.rect(0, A4[1] - 1.5 * cm, A4[0], 1.5 * cm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 14)
    canvas.drawString(2 * cm, A4[1] - 1.1 * cm, "SocietyOps")
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(A4[0] - 2 * cm, A4[1] - 1.1 * cm, doc.title)
    # Footer
    canvas.setFillColor(colors.grey)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(2 * cm, 0.7 * cm, f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    canvas.drawRightString(A4[0] - 2 * cm, 0.7 * cm, f"Page {doc.page}")
    canvas.restoreState()


def _styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle("SOTitle", parent=s["Title"], textColor=BRAND_BLUE, fontSize=16))
    s.add(ParagraphStyle("SOSection", parent=s["Heading2"], textColor=BRAND_BLUE))
    return s


def _table(data: list[list], col_widths=None):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BRAND_LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


@router.get("/tnpcb")
async def tnpcb_report(current_user: CurrentUser, db: DB):
    """TNPCB inspection pack: CTO details + recent STP logs + lab tests."""
    sid = current_user.society_id

    society_result = await db.execute(select(Society).where(Society.id == sid))
    society = society_result.scalar_one_or_none()

    logs_result = await db.execute(
        select(STPLog).where(STPLog.society_id == sid)
        .order_by(STPLog.logged_at.desc()).limit(30)
    )
    logs = logs_result.scalars().all()

    labs_result = await db.execute(
        select(STPLabTest).where(STPLabTest.society_id == sid)
        .order_by(STPLabTest.test_date.desc()).limit(12)
    )
    labs = labs_result.scalars().all()

    buf, doc = _build_doc("TNPCB Inspection Pack")
    styles = _styles()
    story = []

    # Cover
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("TNPCB Inspection Pack", styles["SOTitle"]))
    story.append(Paragraph(society.name if society else "—", styles["Normal"]))
    story.append(Paragraph(f"CTO Number: {society.cto_number or '—'}", styles["Normal"]))
    story.append(Paragraph(f"CTO Expiry: {society.cto_expiry or '—'}", styles["Normal"]))
    story.append(Spacer(1, 0.5 * cm))

    # STP Logs table
    story.append(Paragraph("Recent STP Operational Logs (Last 30)", styles["SOSection"]))
    log_data = [["Date", "Shift", "pH", "MLSS", "Inlet Flow", "Outlet Flow", "Blower Hrs"]]
    for l in logs:
        log_data.append([
            l.logged_at.strftime("%Y-%m-%d") if l.logged_at else "—",
            l.shift or "—",
            str(l.ph or "—"),
            str(l.mlss or "—"),
            str(l.inlet_flow or "—"),
            str(l.outlet_flow or "—"),
            str(l.blower_run_hours or "—"),
        ])
    story.append(_table(log_data))
    story.append(Spacer(1, 0.5 * cm))

    # Lab Tests table
    story.append(Paragraph("Lab Test Results", styles["SOSection"]))
    lab_data = [["Date", "Lab", "Inlet BOD", "Outlet BOD", "Removal %", "pH", "Breach"]]
    for t in labs:
        lab_data.append([
            t.test_date.strftime("%Y-%m-%d") if t.test_date else "—",
            t.lab_name or "—",
            str(t.inlet_bod or "—"),
            str(t.outlet_bod or "—"),
            f"{t.removal_efficiency_bod:.1f}%" if t.removal_efficiency_bod else "—",
            str(t.ph or "—"),
            "YES" if t.breach_flag else "No",
        ])
    story.append(_table(lab_data))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                              headers={"Content-Disposition": "attachment; filename=tnpcb_inspection_pack.pdf"})


@router.get("/agm")
async def agm_report(current_user: CurrentUser, db: DB):
    """AGM operations & compliance summary."""
    sid = current_user.society_id

    society_result = await db.execute(select(Society).where(Society.id == sid))
    society = society_result.scalar_one_or_none()

    tasks_result = await db.execute(select(PPMTask).where(PPMTask.society_id == sid, PPMTask.is_active == True))
    tasks = tasks_result.scalars().all()
    overdue = [t for t in tasks if t.next_due and t.next_due < date.today()]

    docs_result = await db.execute(select(ComplianceDoc).where(ComplianceDoc.society_id == sid))
    docs = docs_result.scalars().all()

    buf, doc = _build_doc("AGM Operations & Compliance Summary")
    styles = _styles()
    story = []

    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("AGM Operations & Compliance Summary", styles["SOTitle"]))
    story.append(Paragraph(society.name if society else "—", styles["Normal"]))
    story.append(Paragraph(f"Report Date: {date.today().isoformat()}", styles["Normal"]))
    story.append(Spacer(1, 0.5 * cm))

    # PPM summary
    story.append(Paragraph("Preventive Maintenance Summary", styles["SOSection"]))
    ppm_data = [["Metric", "Value"]]
    ppm_data.append(["Total Active Tasks", str(len(tasks))])
    ppm_data.append(["Overdue Tasks", str(len(overdue))])
    ppm_data.append(["Statutory Tasks", str(sum(1 for t in tasks if t.is_statutory))])
    story.append(_table(ppm_data, col_widths=[10 * cm, 5 * cm]))
    story.append(Spacer(1, 0.5 * cm))

    # Compliance docs
    story.append(Paragraph("Compliance Documents", styles["SOSection"]))
    doc_data = [["Document", "Type", "Expiry", "Status"]]
    for d in sorted(docs, key=lambda x: x.expiry_date or date.min):
        status = "OK"
        if d.expiry_date:
            if d.expiry_date < date.today():
                status = "EXPIRED"
            elif d.expiry_date < date.today() + timedelta(days=30):
                status = "CRITICAL"
            elif d.expiry_date < date.today() + timedelta(days=90):
                status = "WARNING"
        doc_data.append([d.title, d.doc_type, str(d.expiry_date or "—"), status])
    story.append(_table(doc_data))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                              headers={"Content-Disposition": "attachment; filename=agm_summary.pdf"})


@router.get("/audit")
async def audit_report(current_user: CurrentUser, db: DB,
                        from_date: date | None = None, to_date: date | None = None):
    """Audit trail export for a date range."""
    sid = current_user.society_id
    q = select(AuditEntry).where(AuditEntry.society_id == sid)
    if from_date:
        q = q.where(AuditEntry.timestamp >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        q = q.where(AuditEntry.timestamp <= datetime.combine(to_date, datetime.max.time()))
    result = await db.execute(q.order_by(AuditEntry.timestamp.desc()).limit(1000))
    entries = result.scalars().all()

    buf, doc = _build_doc("Audit Trail Export")
    styles = _styles()
    story = []

    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("Audit Trail Export", styles["SOTitle"]))
    date_range = f"{from_date or 'beginning'} to {to_date or 'now'}"
    story.append(Paragraph(f"Period: {date_range}", styles["Normal"]))
    story.append(Spacer(1, 0.5 * cm))

    audit_data = [["Timestamp", "Action", "Entity", "Entity ID", "User ID"]]
    for e in entries:
        audit_data.append([
            e.timestamp.strftime("%Y-%m-%d %H:%M") if e.timestamp else "—",
            e.action,
            e.entity_type,
            str(e.entity_id or "—"),
            str(e.user_id or "—"),
        ])
    story.append(_table(audit_data))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                              headers={"Content-Disposition": "attachment; filename=audit_trail.pdf"})
