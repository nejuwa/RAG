import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text
from redis import Redis

from app.auth_routes import router as auth_router
from app.database import Base, engine
from app.guest_routes import router as guest_router
from app.research_routes import router as research_router
from app.settings import settings, validate_settings
from app.vector_store import get_vector_store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    validate_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    get_vector_store()
    yield


app = FastAPI(title="Research Intelligence Agent API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)
app.include_router(auth_router)
app.include_router(research_router)
app.include_router(guest_router)


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict):
        error = {
            "code": str(detail.get("code", "REQUEST_FAILED")),
            "message": str(detail.get("message", "The request could not be completed.")),
        }
    else:
        error = {"code": "REQUEST_FAILED", "message": str(detail)}
    return JSONResponse(status_code=exc.status_code, content={"error": error}, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    fields: dict[str, list[str]] = {}
    for error in exc.errors():
        field = ".".join(str(part) for part in error.get("loc", ()) if part != "body")
        fields.setdefault(field or "request", []).append(
            error.get("msg", "Invalid value.")
        )
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "One or more fields are invalid.",
                "details": fields,
            }
        },
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled request error at %s %s.", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred. Please retry.",
            }
        },
    )


@app.get("/health")
def health() -> JSONResponse:
    checks: dict[str, str] = {}
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        logger.exception("Database health check failed.")
        checks["database"] = "unavailable"
    try:
        get_vector_store().get_collections()
        checks["vector_store"] = "ok"
    except Exception:
        logger.exception("Vector store health check failed.")
        checks["vector_store"] = "unavailable"
    queue: Redis | None = None
    try:
        if settings.environment == "local":
            checks["queue"] = "inline"
        else:
            queue = Redis.from_url(settings.redis_url, socket_connect_timeout=2)
            queue.ping()
            checks["queue"] = "ok"
    except Exception:
        logger.exception("Job queue health check failed.")
        checks["queue"] = "unavailable"
    finally:
        if queue is not None:
            queue.close()
    status_code = 200 if all(value in {"ok", "inline"} for value in checks.values()) else 503
    return JSONResponse(
        status_code=status_code,
        content={"status": "ok" if status_code == 200 else "degraded", "checks": checks},
    )
