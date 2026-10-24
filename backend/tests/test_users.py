"""
User management API: super_admin-only access, society scoping, self-lockout
guard, and the password create/reset/change flows.
Requires a real PostgreSQL DB (set DATABASE_URL / DATABASE_URL_SYNC env vars).
"""
import secrets

import pytest

from app.models.society import Society
from app.models.user import User, UserRole
from app.core.security import hash_password, create_access_token


async def _setup(db):
    tag = secrets.token_hex(4)
    soc = Society(name=f"Soc {tag}")
    other = Society(name=f"Other {tag}")
    db.add_all([soc, other])
    await db.flush()
    admin = User(society_id=soc.id, name="Admin", email=f"admin_{tag}@t.in",
                 role=UserRole.super_admin, password_hash=hash_password("adminpass"))
    committee = User(society_id=soc.id, name="Comm", email=f"comm_{tag}@t.in",
                     role=UserRole.committee, password_hash=hash_password("commpass"))
    outsider = User(society_id=other.id, name="Out", email=f"out_{tag}@t.in",
                    role=UserRole.operator, password_hash=hash_password("outpass"))
    db.add_all([admin, committee, outsider])
    await db.commit()
    return tag, admin, committee, outsider


def _auth(user: User) -> dict:
    token = create_access_token({"sub": str(user.id), "role": user.role.value, "society_id": user.society_id})
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_only_super_admin_manages_users(client, async_db):
    _, admin, committee, outsider = await _setup(async_db)

    assert (await client.get("/api/v1/users", headers=_auth(committee))).status_code == 403

    resp = await client.get("/api/v1/users", headers=_auth(admin))
    assert resp.status_code == 200
    emails = {u["email"] for u in resp.json()}
    assert admin.email in emails and committee.email in emails
    assert outsider.email not in emails

    # Cannot touch a user from another society
    resp = await client.patch(f"/api/v1/users/{outsider.id}", json={"is_active": False}, headers=_auth(admin))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_user_then_login_and_change_password(client, async_db):
    tag, admin, _, _ = await _setup(async_db)
    email = f"New.Op_{tag}@T.in"

    resp = await client.post("/api/v1/users", headers=_auth(admin),
                             json={"name": "New Op", "email": email, "role": "operator"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["user"]["email"] == email.lower()
    temp = body["temporary_password"]

    dup = await client.post("/api/v1/users", headers=_auth(admin),
                            json={"name": "Dup", "email": email.upper(), "role": "operator"})
    assert dup.status_code == 409

    login = await client.post("/api/v1/auth/login", json={"email": email, "password": temp})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    bad = await client.post("/api/v1/auth/change-password", headers=headers,
                            json={"current_password": "wrong", "new_password": "newpassword1"})
    assert bad.status_code == 400
    ok = await client.post("/api/v1/auth/change-password", headers=headers,
                           json={"current_password": temp, "new_password": "newpassword1"})
    assert ok.status_code == 204
    assert (await client.post("/api/v1/auth/login", json={"email": email, "password": "newpassword1"})).status_code == 200


@pytest.mark.asyncio
async def test_reset_deactivate_and_self_lockout_guard(client, async_db):
    _, admin, committee, _ = await _setup(async_db)

    resp = await client.post(f"/api/v1/users/{committee.id}/reset-password", headers=_auth(admin))
    assert resp.status_code == 200
    new_pw = resp.json()["temporary_password"]
    assert (await client.post("/api/v1/auth/login", json={"email": committee.email, "password": "commpass"})).status_code == 401
    assert (await client.post("/api/v1/auth/login", json={"email": committee.email, "password": new_pw})).status_code == 200

    resp = await client.patch(f"/api/v1/users/{committee.id}", json={"is_active": False}, headers=_auth(admin))
    assert resp.status_code == 200 and resp.json()["is_active"] is False
    assert (await client.post("/api/v1/auth/login", json={"email": committee.email, "password": new_pw})).status_code == 401

    for change in ({"is_active": False}, {"role": "committee"}):
        resp = await client.patch(f"/api/v1/users/{admin.id}", json=change, headers=_auth(admin))
        assert resp.status_code == 400
    assert (await client.patch(f"/api/v1/users/{admin.id}", json={"name": "Renamed"}, headers=_auth(admin))).status_code == 200
