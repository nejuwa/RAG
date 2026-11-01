import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def _normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgres://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgres://")
    if database_url.startswith("postgresql://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgresql://")
    return database_url


@dataclass(frozen=True)
class Settings:
    environment: str = os.getenv("RIA_ENV", "development")
    ingestion_mode: str = os.getenv(
        "INGESTION_MODE",
        "inline" if os.getenv("RIA_ENV", "development") == "local" else "queue",
    ).lower()
    secret_key: str = os.getenv("SECRET_KEY", "")
    database_url: str = _normalize_database_url(
        os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/rag",
        )
    )
    qdrant_url: str = os.getenv("QDRANT_URL", "http://localhost:6333")
    qdrant_local_path: Path = Path(
        os.getenv("QDRANT_LOCAL_PATH", "data/qdrant")
    ).resolve()
    qdrant_api_key: str | None = os.getenv("QDRANT_API_KEY") or None
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    )
    gemini_api_key: str | None = os.getenv("GEMINI_API_KEY") or None
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    gemini_embedding_model: str = os.getenv(
        "GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"
    )
    gemini_answer_timeout_seconds: float = float(
        os.getenv("GEMINI_ANSWER_TIMEOUT_SECONDS", "180")
    )
    gemini_embedding_timeout_seconds: float = float(
        os.getenv("GEMINI_EMBEDDING_TIMEOUT_SECONDS", "90")
    )
    gemini_max_retries: int = int(os.getenv("GEMINI_MAX_RETRIES", "1"))
    embedding_dimensions: int = int(os.getenv("EMBEDDING_DIMENSIONS", "768"))
    upload_dir: Path = Path(os.getenv("UPLOAD_DIR", "data/uploads")).resolve()
    upload_storage: str = os.getenv("UPLOAD_STORAGE", "local").lower()
    s3_bucket: str = os.getenv("S3_BUCKET", "")
    s3_region: str = os.getenv("S3_REGION", "us-east-1")
    s3_endpoint_url: str = os.getenv("S3_ENDPOINT_URL", "")
    s3_access_key_id: str = os.getenv("S3_ACCESS_KEY_ID", "")
    s3_secret_access_key: str = os.getenv("S3_SECRET_ACCESS_KEY", "")
    max_upload_bytes: int = int(os.getenv("MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))
    max_pdf_pages: int = int(os.getenv("MAX_PDF_PAGES", "500"))
    max_url_count: int = int(os.getenv("MAX_URL_COUNT", "5"))
    domain_min_interval_seconds: float = float(
        os.getenv("DOMAIN_MIN_INTERVAL_SECONDS", "1")
    )
    chunk_size: int = int(os.getenv("CHUNK_SIZE", "3200"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "400"))
    retrieval_top_k: int = int(os.getenv("RETRIEVAL_TOP_K", "12"))
    cookie_secure: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"


settings = Settings()


def validate_settings() -> None:
    if len(settings.secret_key) < 32:
        raise RuntimeError("SECRET_KEY must be configured with at least 32 characters.")
    if settings.ingestion_mode not in {"inline", "queue"}:
        raise RuntimeError("INGESTION_MODE must be either inline or queue.")
    if settings.environment == "test":
        if not settings.database_url.startswith("sqlite"):
            raise RuntimeError("Tests must use the isolated SQLite test database.")
    elif not settings.database_url.startswith(("postgresql://", "postgresql+psycopg://")):
        raise RuntimeError(
            "DATABASE_URL must point to PostgreSQL. Configure your PostgreSQL database "
            "connection in the project-root .env file."
        )
    if not 1 <= settings.embedding_dimensions <= 3072:
        raise RuntimeError("EMBEDDING_DIMENSIONS must be between 1 and 3072.")
    if not (
        1 <= settings.gemini_answer_timeout_seconds <= 600
        and 1 <= settings.gemini_embedding_timeout_seconds <= 600
    ):
        raise RuntimeError("Gemini request timeouts must be between 1 and 600 seconds.")
    if not 0 <= settings.gemini_max_retries <= 3:
        raise RuntimeError("GEMINI_MAX_RETRIES must be between 0 and 3.")
    if settings.chunk_size <= settings.chunk_overlap or settings.chunk_overlap < 0:
        raise RuntimeError("CHUNK_SIZE must be greater than CHUNK_OVERLAP.")
    if (
        settings.max_upload_bytes <= 0
        or settings.max_pdf_pages < 1
        or settings.max_url_count < 1
        or settings.domain_min_interval_seconds < 0
    ):
        raise RuntimeError("Upload/page/URL limits must be positive and the domain interval non-negative.")
    if settings.environment == "production" and not settings.cookie_secure:
        raise RuntimeError("COOKIE_SECURE must be true in production.")
    if settings.upload_storage not in {"local", "s3"}:
        raise RuntimeError("UPLOAD_STORAGE must be either local or s3.")
    if settings.upload_storage == "s3" and not all(
        (
            settings.s3_bucket,
            settings.s3_region,
            settings.s3_access_key_id,
            settings.s3_secret_access_key,
        )
    ):
        raise RuntimeError(
            "S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY "
            "must be configured when UPLOAD_STORAGE=s3."
        )
