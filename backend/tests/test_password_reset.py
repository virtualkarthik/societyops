"""
Forgot password: emailed temp password that sits alongside the current one,
expires, forces a change on use, and never reveals whether an account exists.
Requires a real PostgreSQL DB (set DATABASE_URL / DATABASE_URL_SYNC env vars).
"""
import re
import secrets
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.api.v1 import auth as auth_api
from app.core.security import hash_password
from app.models.society import Society
from app.models.user import User, UserRole


@pytest.fixture
def outbox(monkeypatch):
    sent = []
    monkeypatch.setattr(auth_api, "send_email", lambda to, subject, body: sent.append((to, subject, body)))
    return sent


async def _user(db, email=None, phone=None):
    tag = secrets.token_hex(4)
    soc = Society(name=f"Opera {tag}")
    db.add(soc)
    await db.flush()
    u = User(society_id=soc.id, name="Resi", email=email and email.format(tag=tag), phone=phone,
             role=UserRole.resident, password_hash=hash_password("oldpassword"))
    db.add(u)
    await db.commit()
    return u


def _temp_from(body: str) -> str:
    return re.search(r"Temporary password: (\S+)", body).group(1)


@pytest.mark.asyncio
async def test_forgot_password_emails_temp_and_forces_change(client, async_db, outbox):
    user = await _user(async_db, email="resi_{tag}@t.in")

    resp = await client.post("/api/v1/auth/forgot-password", json={"login": user.email.upper()})
    assert resp.status_code == 202
    assert len(outbox) == 1
    to, subject, body = outbox[0]
    assert to == user.email and "Opera" in subject
    temp = _temp_from(body)

    # Old password still works (a stranger's request can't lock the user out)
    old = await client.post("/api/v1/auth/login", json={"login": user.email, "password": "oldpassword"})
    assert old.status_code == 200 and old.json()["must_change_password"] is False

    login = await client.post("/api/v1/auth/login", json={"login": user.email, "password": temp})
    assert login.status_code == 200 and login.json()["must_change_password"] is True
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert (await client.get("/api/v1/complaints", headers=headers)).status_code == 403

    assert (await client.post("/api/v1/auth/change-password", headers=headers,
                              json={"new_password": "brandnew123"})).status_code == 204
    # Temp password is spent; new one works
    assert (await client.post("/api/v1/auth/login", json={"login": user.email, "password": temp})).status_code == 401
    assert (await client.post("/api/v1/auth/login", json={"login": user.email, "password": "brandnew123"})).status_code == 200


@pytest.mark.asyncio
async def test_forgot_password_cooldown_and_expiry(client, async_db, outbox):
    user = await _user(async_db, email="cool_{tag}@t.in")
    await client.post("/api/v1/auth/forgot-password", json={"login": user.email})
    await client.post("/api/v1/auth/forgot-password", json={"login": user.email})
    assert len(outbox) == 1  # second request inside the cooldown is ignored
    temp = _temp_from(outbox[0][2])

    # Expire it
    db_user = await async_db.scalar(select(User).where(User.id == user.id))
    db_user.temp_password_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await async_db.commit()
    assert (await client.post("/api/v1/auth/login", json={"login": user.email, "password": temp})).status_code == 401


@pytest.mark.asyncio
async def test_forgot_password_reveals_nothing(client, async_db, outbox):
    phone_only = await _user(async_db, phone=f"+9198{secrets.randbelow(10**8):08d}")
    unknown = await client.post("/api/v1/auth/forgot-password", json={"login": "nobody@nowhere.in"})
    by_phone = await client.post("/api/v1/auth/forgot-password", json={"login": phone_only.phone})
    assert unknown.status_code == by_phone.status_code == 202
    assert unknown.json() == by_phone.json()
    assert outbox == []  # phone-only users have nowhere to receive it
