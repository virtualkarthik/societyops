"""
Tests that society_id query scoping prevents cross-society data leaks.
Requires a real PostgreSQL DB (set DATABASE_URL / DATABASE_URL_SYNC env vars).
"""
import pytest
import pytest_asyncio
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.society import Society
from app.models.user import User, UserRole
from app.models.asset import Asset, AssetType
from app.models.stp import STPLog, Shift
from app.core.security import hash_password, create_access_token


pytestmark = pytest.mark.asyncio


async def _make_society(db: AsyncSession, name: str) -> Society:
    s = Society(name=name, address="Test")
    db.add(s)
    await db.flush()
    return s


async def _make_user(db: AsyncSession, society_id: int, email: str, role=UserRole.operator) -> User:
    u = User(society_id=society_id, name="Test", email=email, role=role,
             password_hash=hash_password("pass"))
    db.add(u)
    await db.flush()
    return u


async def _make_asset(db: AsyncSession, society_id: int) -> Asset:
    import secrets
    a = Asset(society_id=society_id, type=AssetType.STP, name="STP",
              qr_token=secrets.token_urlsafe(8), is_active=True)
    db.add(a)
    await db.flush()
    return a


async def _make_stp_log(db: AsyncSession, society_id: int, asset_id: int, operator_id: int) -> STPLog:
    log = STPLog(
        society_id=society_id, asset_id=asset_id, operator_id=operator_id,
        logged_at=datetime.now(timezone.utc), shift=Shift.AM, ph=7.0,
    )
    db.add(log)
    await db.flush()
    return log


@pytest.mark.asyncio
async def test_stp_logs_scoped_by_society(client, async_db):
    """STP logs for society A must not appear in society B's response."""
    db = async_db

    soc_a = await _make_society(db, "Society A")
    soc_b = await _make_society(db, "Society B")

    op_a = await _make_user(db, soc_a.id, f"op_a_{soc_a.id}@test.com")
    op_b = await _make_user(db, soc_b.id, f"op_b_{soc_b.id}@test.com")

    asset_a = await _make_asset(db, soc_a.id)
    asset_b = await _make_asset(db, soc_b.id)

    log_a = await _make_stp_log(db, soc_a.id, asset_a.id, op_a.id)
    log_b = await _make_stp_log(db, soc_b.id, asset_b.id, op_b.id)
    await db.commit()

    # Authenticate as society A operator
    token_a = create_access_token({"sub": str(op_a.id), "role": "operator", "society_id": soc_a.id})
    headers_a = {"Authorization": f"Bearer {token_a}"}

    response = await client.get("/api/v1/stp/logs", headers=headers_a)
    assert response.status_code == 200
    ids = [r["id"] for r in response.json()]
    assert log_a.id in ids
    assert log_b.id not in ids, "Society B log leaked into Society A's response"


@pytest.mark.asyncio
async def test_asset_scoped_by_society(client, async_db):
    """Assets from society B must not appear in society A's list."""
    db = async_db

    soc_a = await _make_society(db, "Scoping Test A")
    soc_b = await _make_society(db, "Scoping Test B")
    op_a = await _make_user(db, soc_a.id, f"scope_op_a_{soc_a.id}@test.com")
    op_b = await _make_user(db, soc_b.id, f"scope_op_b_{soc_b.id}@test.com")

    asset_a = await _make_asset(db, soc_a.id)
    asset_b = await _make_asset(db, soc_b.id)
    await db.commit()

    token_a = create_access_token({"sub": str(op_a.id), "role": "operator", "society_id": soc_a.id})
    response = await client.get("/api/v1/assets", headers={"Authorization": f"Bearer {token_a}"})
    assert response.status_code == 200
    ids = [r["id"] for r in response.json()]
    assert asset_a.id in ids
    assert asset_b.id not in ids, "Society B asset leaked into Society A's asset list"
