"""
Test fixtures. Uses a real PostgreSQL database via DATABASE_URL_SYNC env var.
Falls back to sqlite+aiosqlite for unit tests that don't need PG-specific features.
"""
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import Session

from app.db.base import Base
from app.core.config import settings


def pytest_collection_modifyitems(items):
    # The async engine fixture is session-scoped, so every async test must share
    # the session event loop or asyncpg raises "attached to a different loop".
    session_scope_marker = pytest.mark.asyncio(loop_scope="session")
    for item in items:
        if pytest_asyncio.is_async_test(item):
            item.add_marker(session_scope_marker, append=False)


# ── Sync engine for simple unit tests ─────────────────────────────────────────

@pytest.fixture(scope="session")
def sync_engine():
    db_url = os.environ.get("DATABASE_URL_SYNC", settings.DATABASE_URL_SYNC)
    engine = create_engine(db_url, pool_pre_ping=True)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)


@pytest.fixture
def db_session(sync_engine):
    with Session(sync_engine) as session:
        yield session
        session.rollback()


# ── Async engine + HTTP client for integration tests ──────────────────────────

@pytest_asyncio.fixture(scope="session")
async def async_engine():
    db_url = os.environ.get("DATABASE_URL", settings.DATABASE_URL)
    engine = create_async_engine(db_url, pool_pre_ping=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def async_db(async_engine):
    SessionLocal = async_sessionmaker(async_engine, expire_on_commit=False, class_=AsyncSession)
    async with SessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(async_engine):
    from app.main import app
    from app.db.session import get_db
    from sqlalchemy.ext.asyncio import AsyncSession

    SessionLocal = async_sessionmaker(async_engine, expire_on_commit=False, class_=AsyncSession)

    async def override_get_db():
        async with SessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
