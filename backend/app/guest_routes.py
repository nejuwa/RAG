import time
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth import require_csrf
from app.providers import GeminiProvider, ProviderError
from app.schemas import GuestAskInput, GuestAskOut

router = APIRouter(prefix="/api/v1/guest")
_rate_lock = Lock()
_attempts: dict[str, tuple[float, int]] = {}
_RATE_LIMIT = 5
_RATE_WINDOW_SECONDS = 60


def _enforce_guest_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with _rate_lock:
        started, count = _attempts.get(client_ip, (now, 0))
        if now - started >= _RATE_WINDOW_SECONDS:
            started, count = now, 0
        if count >= _RATE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "RATE_LIMITED",
                    "message": "Too many guest questions. Please try again in a minute.",
                },
            )
        _attempts[client_ip] = (started, count + 1)
        if len(_attempts) > 10_000:
            for key, (window_started, _) in list(_attempts.items()):
                if now - window_started >= _RATE_WINDOW_SECONDS:
                    _attempts.pop(key, None)


@router.post(
    "/ask",
    response_model=GuestAskOut,
    dependencies=[Depends(require_csrf), Depends(_enforce_guest_rate_limit)],
)
def ask_as_guest(payload: GuestAskInput) -> GuestAskOut:
    try:
        answer = GeminiProvider().generate_general_answer(payload.query)
    except ProviderError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "PROVIDER_UNAVAILABLE",
                "message": str(exc),
            },
        ) from exc
    return GuestAskOut(answer=answer, provider="google-gemini")
