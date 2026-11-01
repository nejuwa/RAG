from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.auth import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    create_auth_session,
    enforce_login_rate_limit,
    get_current_user,
    get_optional_session,
    hash_password,
    require_csrf,
    revoke_current_session,
    rotate_refresh_session,
    set_csrf_cookie,
    verify_password,
)
from app.database import get_db
from app.models import Collection, User
from app.schemas import LoginInput, RegisterInput, UserOut
from app.settings import settings

router = APIRouter(prefix="/api")
mutating = [Depends(require_csrf)]


def user_out(user: User) -> dict[str, object]:
    return {
        "id": user.id,
        "email": user.email,
        "displayName": user.display_name,
        "avatarUrl": None,
        "status": "ONLINE",
        "lastSeen": None,
    }


@router.get("/auth/csrf")
def csrf(response: Response) -> dict[str, str]:
    return {"csrfToken": set_csrf_cookie(response)}


@router.post("/auth/register", dependencies=mutating)
def register(
    payload: RegisterInput,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    enforce_login_rate_limit(request)
    email = str(payload.email).strip().lower()
    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={"code": "EMAIL_EXISTS", "message": "An account with this email already exists."},
        )
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        display_name=payload.displayName,
    )
    db.add(user)
    db.flush()
    db.add(Collection(owner_id=user.id, name="My research", visibility="private"))
    record_audit(db, "user_registered", user.id, "user", user.id)
    db.commit()
    csrf_token = create_auth_session(response, user, db, "user_registered_session")
    return {"data": user_out(user), "csrfToken": csrf_token}


@router.post("/auth/login", dependencies=mutating)
def login(
    payload: LoginInput,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    enforce_login_rate_limit(request)
    email = str(payload.email).strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        record_audit(db, "login_failed", user.id if user else None, "user", user.id if user else None)
        db.commit()
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_CREDENTIALS", "message": "Email or password is incorrect."},
        )
    csrf_token = create_auth_session(response, user, db)
    return {"data": user_out(user), "csrfToken": csrf_token}


@router.post("/auth/refresh", dependencies=mutating)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    user = rotate_refresh_session(request, response, db)
    csrf_token = set_csrf_cookie(response)
    return {"data": user_out(user), "csrfToken": csrf_token}


@router.post("/auth/logout", dependencies=mutating)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> Response:
    session = revoke_current_session(request, db)
    if session is not None:
        record_audit(db, "logout", session.user_id, "session", session.id)
        db.commit()
    for name, path in ((ACCESS_COOKIE, "/"), (REFRESH_COOKIE, "/api/auth")):
        response.delete_cookie(
            name,
            path=path,
            secure=settings.cookie_secure,
            httponly=True,
            samesite="lax",
        )
    response.delete_cookie("csrf_token", path="/", samesite="lax")
    response.status_code = 204
    return response


@router.get("/users/me")
def current_user(user: User = Depends(get_current_user)) -> dict[str, object]:
    return {"data": user_out(user)}
