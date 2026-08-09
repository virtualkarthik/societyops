from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.api.v1 import auth, assets, stp, water, dg, ppm, compliance, inventory, complaints, dashboard, reports, sync, service, housekeeping, locations

app = FastAPI(title="SocietyOps API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(assets.router, prefix=PREFIX)
app.include_router(stp.router, prefix=PREFIX)
app.include_router(water.router, prefix=PREFIX)
app.include_router(dg.router, prefix=PREFIX)
app.include_router(ppm.router, prefix=PREFIX)
app.include_router(compliance.router, prefix=PREFIX)
app.include_router(inventory.router, prefix=PREFIX)
app.include_router(complaints.router, prefix=PREFIX)
app.include_router(dashboard.router, prefix=PREFIX)
app.include_router(reports.router, prefix=PREFIX)
app.include_router(sync.router, prefix=PREFIX)
app.include_router(service.router, prefix=PREFIX)
app.include_router(housekeeping.router, prefix=PREFIX)
app.include_router(locations.router, prefix=PREFIX)

# QR scan redirect
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import AsyncSessionLocal
from app.models.asset import Asset


@app.get("/scan/{qr_token}")
async def qr_scan_redirect(qr_token: str):
    """Deep-link from a printed QR code → asset quick-log page in the SPA."""
    return RedirectResponse(url=f"/assets/scan/{qr_token}", status_code=302)


# Serve uploaded files
uploads_dir = settings.UPLOADS_DIR
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "service": "SocietyOps API"}
