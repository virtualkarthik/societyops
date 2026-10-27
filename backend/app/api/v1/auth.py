import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from app.core.config import settings
from app.core.deps import CurrentUser, DB
from app.core.identity import is_email, normalize_phone
from app.core.security import verify_password, create_access_token, hash_password
from app.models.society import Society
from app.models.user import User
from app.schemas.auth import BrandingOut, ForgotPasswordRequest, LoginRequest, MeOut, TokenResponse
from app.schemas.user import ChangePasswordRequest
from app.services.audit import log_audit
from app.services.email import send_email

router = APIRouter(prefix="/auth", tags=["auth"])


async def find_user_by_login(db: DB, identifier: str) -> User | None:
    """Look up an active user by email (contains '@') or phone number."""
    if is_email(identifier):
        clause = func.lower(User.email) == identifier.lower()
    else:
        try:
            clause = User.phone == normalize_phone(identifier)
        except ValueError:
            return None
    return await db.scalar(select(User).where(clause, User.is_active == True))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: DB):
    user = await find_user_by_login(db, body.identifier)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(body.password, user.password_hash):
        if not _temp_password_matches(user, body.password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        user.must_change_password = True
        await log_audit(db, user.society_id, user.id, "LOGIN_TEMP_PASSWORD", "User", user.id)
        await db.commit()
    token = create_access_token({"sub": str(user.id), "role": user.role, "society_id": user.society_id})
    return TokenResponse(access_token=token, must_change_password=user.must_change_password)


def _temp_password_matches(user: User, password: str) -> bool:
    return bool(
        user.temp_password_hash
        and user.temp_password_expires_at
        and user.temp_password_expires_at > datetime.now(timezone.utc)
        and verify_password(password, user.temp_password_hash)
    )


FORGOT_PASSWORD_MESSAGE = (
    "If that account has an email address, a temporary password is on its way. "
    "If you log in with a phone number only, ask your administrator to reset your password."
)


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(body: ForgotPasswordRequest, db: DB, background: BackgroundTasks):
    """Emails a temporary password (valid TEMP_PASSWORD_TTL_MINUTES) alongside the
    current one. Same response whether or not the account exists."""
    user = await find_user_by_login(db, body.login.strip())
    if user and user.email:
        now = datetime.now(timezone.utc)
        ttl = timedelta(minutes=settings.TEMP_PASSWORD_TTL_MINUTES)
        sent_at = user.temp_password_expires_at - ttl if user.temp_password_expires_at else None
        if sent_at is None or now - sent_at >= timedelta(minutes=settings.FORGOT_PASSWORD_COOLDOWN_MINUTES):
            temp = secrets.token_urlsafe(9)
            user.temp_password_hash = hash_password(temp)
            user.temp_password_expires_at = now + ttl
            society = await db.get(Society, user.society_id)
            await log_audit(db, user.society_id, user.id, "FORGOT_PASSWORD", "User", user.id)
            await db.commit()
            background.add_task(send_email, user.email, *_temp_password_email(user, temp, society))
    return {"detail": FORGOT_PASSWORD_MESSAGE}


def _temp_password_email(user: User, temp: str, society: Society | None) -> tuple[str, str]:
    place = society.name if society else "SocietyOps"
    subject = f"Your temporary password for {place}"
    body = f"""Hello {user.name},

We received a request to reset your {place} password.

Temporary password: {temp}

Log in at {settings.FRONTEND_ORIGIN} with this password within {settings.TEMP_PASSWORD_TTL_MINUTES} minutes.
You will be asked to choose a new password straight away.

If you didn't ask for this, ignore this email - your current password still works.

- {place} (SocietyOps)
"""
    return subject, body


@router.get("/me", response_model=MeOut)
async def me(current_user: CurrentUser, db: DB):
    society = await db.get(Society, current_user.society_id)
    return MeOut.model_validate(current_user).model_copy(update={"society_name": society.name if society else None})


async def _instance_society_name(db: DB) -> str | None:
    """Each production instance serves one society; with several (e.g. a shared
    demo) the name is not revealed publicly."""
    names = (await db.scalars(select(Society.name).limit(2))).all()
    return names[0] if len(names) == 1 else None


def _short_name(name: str) -> str:
    """Home-screen labels truncate around 12 characters."""
    if len(name) <= 12:
        return name
    short = name.replace("Apartments", "Apts").replace("Apartment", "Apt")
    return short if len(short) <= 12 else name.split()[0]


@router.get("/branding", response_model=BrandingOut)
async def branding(db: DB):
    """Public: the society name for the login screen."""
    return BrandingOut(society_name=await _instance_society_name(db))


@router.get("/manifest.webmanifest")
async def web_manifest(db: DB):
    """PWA manifest, named after the society so the installed app shows its name."""
    name = await _instance_society_name(db)
    manifest = {
        "name": f"{name} · SocietyOps" if name else "SocietyOps",
        "short_name": _short_name(name) if name else "SocietyOps",
        "description": "Society Maintenance & Operations — facility and compliance tracker",
        "theme_color": "#115e59",
        "background_color": "#fafaf9",
        "display": "standalone",
        "orientation": "any",
        "start_url": "/",
        "scope": "/",
        "icons": [
            {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
            {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
        ],
    }
    return JSONResponse(manifest, media_type="application/manifest+json",
                        headers={"Cache-Control": "public, max-age=3600"})


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(body: ChangePasswordRequest, current_user: CurrentUser, db: DB):
    if not current_user.must_change_password and not (
        body.current_password and verify_password(body.current_password, current_user.password_hash)
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if verify_password(body.new_password, current_user.password_hash) or (
        current_user.temp_password_hash and verify_password(body.new_password, current_user.temp_password_hash)
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a password different from the temporary one")
    current_user.password_hash = hash_password(body.new_password)
    current_user.must_change_password = False
    current_user.temp_password_hash = None
    current_user.temp_password_expires_at = None
    await log_audit(db, current_user.society_id, current_user.id, "CHANGE_PASSWORD", "User", current_user.id)
    await db.commit()
