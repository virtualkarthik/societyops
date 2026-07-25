"""
Tests for idempotent offline sync: submitting the same client_uuid twice
must produce exactly one DB row and return the same server_id.
"""
import pytest
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.society import Society
from app.models.user import User, UserRole
from app.models.asset import Asset, AssetType
from app.models.stp import STPLog
from app.core.security import hash_password, create_access_token

pytestmark = pytest.mark.asyncio


async def _seed_sync_fixtures(db: AsyncSession):
    import secrets
    s = Society(name=f"Sync Test Society {uuid.uuid4().hex[:6]}", address="Test")
    db.add(s)
    await db.flush()

    u = User(society_id=s.id, name="Op", email=f"sync_op_{uuid.uuid4().hex[:6]}@test.com",
             role=UserRole.operator, password_hash=hash_password("x"))
    db.add(u)
    await db.flush()

    a = Asset(society_id=s.id, type=AssetType.STP, name="STP",
              qr_token=secrets.token_urlsafe(8), is_active=True)
    db.add(a)
    await db.flush()
    await db.commit()
    return s, u, a


@pytest.mark.asyncio
async def test_sync_idempotent_stp_log(client, async_db):
    """POSTing the same client_uuid twice must not create a duplicate row."""
    society, user, asset = await _seed_sync_fixtures(async_db)
    token = create_access_token({"sub": str(user.id), "role": "operator", "society_id": society.id})
    headers = {"Authorization": f"Bearer {token}"}

    client_uuid = str(uuid.uuid4())
    payload = {
        "items": [
            {
                "entity_type": "stp_log",
                "client_uuid": client_uuid,
                "payload": {
                    "asset_id": asset.id,
                    "logged_at": datetime.now(timezone.utc).isoformat(),
                    "shift": "AM",
                    "ph": 7.2,
                },
            }
        ]
    }

    # First sync
    r1 = await client.post("/api/v1/sync/batch", json=payload, headers=headers)
    assert r1.status_code == 200
    results1 = r1.json()["results"]
    assert results1[0]["status"] == "synced"
    server_id_1 = results1[0]["server_id"]

    # Second sync with identical client_uuid
    r2 = await client.post("/api/v1/sync/batch", json=payload, headers=headers)
    assert r2.status_code == 200
    results2 = r2.json()["results"]
    assert results2[0]["status"] == "synced"
    server_id_2 = results2[0]["server_id"]

    # Must return the same server_id
    assert server_id_1 == server_id_2, "Duplicate row created on second sync"

    # Verify DB count
    count = (await async_db.execute(
        select(func.count()).select_from(STPLog)
        .where(STPLog.society_id == society.id, STPLog.client_uuid == client_uuid)
    )).scalar()
    assert count == 1, f"Expected 1 row but found {count}"


@pytest.mark.asyncio
async def test_sync_different_uuids_create_separate_rows(client, async_db):
    """Two different client_uuids must create two separate rows."""
    society, user, asset = await _seed_sync_fixtures(async_db)
    token = create_access_token({"sub": str(user.id), "role": "operator", "society_id": society.id})
    headers = {"Authorization": f"Bearer {token}"}

    def _item(cuuid):
        return {
            "entity_type": "stp_log",
            "client_uuid": cuuid,
            "payload": {
                "asset_id": asset.id,
                "logged_at": datetime.now(timezone.utc).isoformat(),
                "shift": "PM",
                "ph": 7.4,
            },
        }

    uuid1, uuid2 = str(uuid.uuid4()), str(uuid.uuid4())
    payload = {"items": [_item(uuid1), _item(uuid2)]}
    r = await client.post("/api/v1/sync/batch", json=payload, headers=headers)
    assert r.status_code == 200
    results = r.json()["results"]
    assert all(res["status"] == "synced" for res in results)
    ids = [res["server_id"] for res in results]
    assert ids[0] != ids[1], "Two distinct UUIDs should produce two distinct rows"
