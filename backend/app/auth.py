import base64
import hashlib
import hmac
import json
import secrets
import time
from datetime import datetime, timedelta, timezone
from threading import Lock
from uuid import uuid4

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.database import get_db
from app.models import AuthSession, User
from app.settings import settings

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"
ACCESS_TTL_SECONDS = 15 * 60
REFRESH_TTL = timedelta(days=14)
_rate_lock = Lock()
_attempts: dict[str, tuple[float, int]] = {}


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _access_token(session_id: str, expires_at: int) -> str:
    payload = _b64(json.dumps({"sid": session_id, "exp": expires_at}).encode("utf-8"))
    signature = hmac.new(
        settings.secret_key.encode("utf-8"), payload.encode("ascii"), hashlib.sha256
    ).digest()
    return f"{payload}.{_b64(signature)}"


def _read_access_token(token: str) -> tuple[str, int] | None:
    try:
        payload, signature = token.split(".", 1)
        expected = hmac.new(
            settings.secret_key.encode("utf-8"), payload.encode("ascii"), hashlib.sha256
        ).digest()
        if not hmac.compare_digest(_unb64(signature), expected):
            return None
        data = json.loads(_unb64(payload))
        session_id = str(data["sid"])
        expires_at = int(data["exp"])
        if expires_at <= int(time.time()):
            return None
        return session_id, expires_at
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        return None


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32
    )
    return f"scrypt${_b64(salt)}${_b64(derived)}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, salt_value, expected_value = stored_hash.split("$")
        if algorithm != "scrypt":
            return False
        salt = _unb64(salt_value)
        expected = _unb64(expected_value)
        actual = hashlib.scrypt(
            password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=len(expected)
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def enforce_login_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with _rate_lock:
        started, count = _attempts.get(client_ip, (now, 0))
        if now - started >= 60:
            started, count = now, 0
        if count >= 10:
            raise HTTPException(
                status_code=429,
                detail={"code": "RATE_LIMITED", "message": "Too many account attempts. Try again shortly."},
            )
        _attempts[client_ip] = (started, count + 1)
        if len(_attempts) > 10_000:
            for key, (window_started, _) in list(_attempts.items()):
                if now - window_started >= 60:
                    _attempts.pop(key, None)


def set_csrf_cookie(response: Response, token: str | None = None) -> str:
    csrf_token = token or secrets.token_urlsafe(32)
    response.set_cookie(
        CSRF_COOKIE,
        csrf_token,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    return csrf_token


def require_csrf(request: Request) -> None:
    cookie = request.cookies.get(CSRF_COOKIE, "")
    header = request.headers.get("x-csrf-token", "")
    if not cookie or not header or not hmac.compare_digest(cookie, header):
        raise HTTPException(
            status_code=403,
            detail={"code": "CSRF_INVALID", "message": "The request could not be verified. Refresh and try again."},
        )


def create_auth_session(
    response: Response,
    user: User,
    db: Session,
    event_type: str = "login_success",
) -> str:
    now = datetime.now(timezone.utc)
    session_id = str(uuid4())
    refresh_token = secrets.token_urlsafe(48)
    session = AuthSession(
        id=session_id,
        user_id=user.id,
        refresh_token_hash=_hash_token(refresh_token),
        expires_at=now + REFRESH_TTL,
    )
    db.add(session)
    record_audit(db, event_type, user.id, "user", user.id)
    db.commit()
    response.set_cookie(
        ACCESS_COOKIE,
        _access_token(session_id, int(now.timestamp()) + ACCESS_TTL_SECONDS),
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=ACCESS_TTL_SECONDS,
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=int(REFRESH_TTL.total_seconds()),
        path="/api/auth",
    )
    return set_csrf_cookie(response)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    token = request.cookies.get(ACCESS_COOKIE, "")
    parsed = _read_access_token(token)
    if parsed is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "Sign in to continue."},
        )
    session_id, _ = parsed
    auth_session = db.get(AuthSession, session_id)
    now = datetime.now(timezone.utc)
    if (
        auth_session is None
        or auth_session.revoked_at is not None
        or _aware(auth_session.expires_at) <= now
    ):
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "Your session has expired. Sign in again."},
        )
    user = db.get(User, auth_session.user_id)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "Sign in to continue."},
        )
    return user


def _aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def get_optional_session(request: Request, db: Session) -> AuthSession | None:
    parsed = _read_access_token(request.cookies.get(ACCESS_COOKIE, ""))
    return db.get(AuthSession, parsed[0]) if parsed else None


def rotate_refresh_session(request: Request, response: Response, db: Session) -> User:
    refresh_token = request.cookies.get(REFRESH_COOKIE, "")
    if not refresh_token:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "Your session has expired. Sign in again."},
        )
    auth_session = db.scalar(
        select(AuthSession).where(AuthSession.refresh_token_hash == _hash_token(refresh_token))
    )
    now = datetime.now(timezone.utc)
    if (
        auth_session is None
        or auth_session.revoked_at is not None
        or _aware(auth_session.expires_at) <= now
    ):
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "Your session has expired. Sign in again."},
        )
    new_refresh_token = secrets.token_urlsafe(48)
    auth_session.refresh_token_hash = _hash_token(new_refresh_token)
    auth_session.expires_at = now + REFRESH_TTL
    user = db.get(User, auth_session.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail={"code": "UNAUTHENTICATED", "message": "Sign in to continue."})
    db.commit()
    response.set_cookie(
        ACCESS_COOKIE,
        _access_token(auth_session.id, int(now.timestamp()) + ACCESS_TTL_SECONDS),
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=ACCESS_TTL_SECONDS,
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        new_refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=int(REFRESH_TTL.total_seconds()),
        path="/api/auth",
    )
    return user


def revoke_current_session(request: Request, db: Session) -> AuthSession | None:
    session = get_optional_session(request, db)
    if session is None:
        refresh_token = request.cookies.get(REFRESH_COOKIE, "")
        if refresh_token:
            session = db.scalar(
                select(AuthSession).where(
                    AuthSession.refresh_token_hash == _hash_token(refresh_token)
                )
            )
    if session is not None:
        session.revoked_at = datetime.now(timezone.utc)
        db.commit()
    return session
