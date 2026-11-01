from sqlalchemy.orm import Session

from app.models import AuditEvent


def record_audit(
    db: Session,
    event_type: str,
    actor_id: str | None,
    resource_type: str | None = None,
    resource_id: str | None = None,
) -> None:
    db.add(
        AuditEvent(
            actor_id=actor_id,
            event_type=event_type,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_json={},
        )
    )
