import json
from datetime import date, datetime, timezone
from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditEntry


def _json_safe(obj: Any) -> Any:
    if obj is None:
        return None
    return json.loads(json.dumps(obj, default=str))


async def log_audit(
    db: AsyncSession,
    society_id: int,
    user_id: Optional[int],
    action: str,
    entity_type: str,
    entity_id: Optional[int],
    before: Optional[dict[str, Any]] = None,
    after: Optional[dict[str, Any]] = None,
) -> None:
    entry = AuditEntry(
        society_id=society_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        timestamp=datetime.now(timezone.utc),
        before_json=_json_safe(before),
        after_json=_json_safe(after),
    )
    db.add(entry)
