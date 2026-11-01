import logging

from fastapi import BackgroundTasks
from redis import Redis
from rq import Queue

from app.ingestion import process_source
from app.settings import settings

logger = logging.getLogger(__name__)


def enqueue_ingestion(
    source_id: str, background_tasks: BackgroundTasks | None = None
) -> None:
    if settings.ingestion_mode == "inline":
        if background_tasks is None:
            raise RuntimeError("Inline ingestion requires FastAPI background tasks.")
        background_tasks.add_task(process_source, source_id)
        return
    try:
        connection = Redis.from_url(settings.redis_url, socket_connect_timeout=3)
        Queue("ingestion", connection=connection).enqueue(
            "app.ingestion.process_source",
            source_id,
            job_timeout=600,
            result_ttl=3600,
            failure_ttl=86400,
        )
    except Exception as exc:
        logger.exception("Could not enqueue ingestion job for source %s.", source_id)
        raise RuntimeError("The ingestion queue is unavailable. Try again shortly.") from exc
