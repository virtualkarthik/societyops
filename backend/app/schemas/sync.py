from typing import Any, Literal
from pydantic import BaseModel


class SyncItem(BaseModel):
    entity_type: Literal["stp_log", "water_log", "dg_log", "ppm_completion"]
    client_uuid: str
    payload: dict[str, Any]


class SyncRequest(BaseModel):
    items: list[SyncItem]


class SyncResult(BaseModel):
    client_uuid: str
    status: Literal["synced", "failed"]
    server_id: int | None = None
    error: str | None = None


class SyncResponse(BaseModel):
    results: list[SyncResult]
