import logging

from redis import Redis
from rq import Queue, Worker

from app.database import Base, engine
from app.settings import settings, validate_settings


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    validate_settings()
    if settings.ingestion_mode != "queue":
        raise RuntimeError("Inline ingestion runs in the API process; do not start a worker.")
    Base.metadata.create_all(bind=engine)
    connection = Redis.from_url(settings.redis_url)
    Worker([Queue("ingestion", connection=connection)], connection=connection).work()


if __name__ == "__main__":
    main()
