import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select

from app.core.deps import DB, require_roles
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.auth import UserOut
from app.schemas.user import UserCreate, UserUpdate, UserWithPassword
from app.services.audit import log_audit

router = APIRouter(prefix="/users", tags=["users"])

SuperAdmin = Depends(require_roles(UserRole.super_admin))


def _temporary_password() -> str:
    return secrets.token_urlsafe(9)


async def _get_or_404(user_id: int, society_id: int, db: DB) -> User:
    user = await db.scalar(select(User).where(User.id == user_id, User.society_id == society_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("", response_model=list[UserOut])
async def list_users(db: DB, current_user: User = SuperAdmin):
    result = await db.execute(
        select(User).where(User.society_id == current_user.society_id).order_by(User.is_active.desc(), User.name)
    )
    return result.scalars().all()


async def _ensure_unique(db: DB, email: str | None, phone: str | None, exclude_id: int | None = None) -> None:
    # Emails and phones are unique across the whole instance, not just this society.
    for column, value, label in ((User.email, email, "email"), (User.phone, phone, "phone number")):
        if value is None:
            continue
        q = select(User.id).where(func.lower(column) == value.lower())
        if exclude_id is not None:
            q = q.where(User.id != exclude_id)
        if await db.scalar(q):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"A user with this {label} already exists")


@router.post("", response_model=UserWithPassword, status_code=status.HTTP_201_CREATED)
async def create_user(body: UserCreate, db: DB, current_user: User = SuperAdmin):
    await _ensure_unique(db, body.email, body.phone)
    password = _temporary_password()
    user = User(society_id=current_user.society_id, password_hash=hash_password(password),
                must_change_password=True, **body.model_dump())
    db.add(user)
    await db.flush()
    await log_audit(db, current_user.society_id, current_user.id, "CREATE", "User", user.id, after=body.model_dump())
    await db.commit()
    await db.refresh(user)
    return UserWithPassword(user=UserOut.model_validate(user), temporary_password=password)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(user_id: int, body: UserUpdate, db: DB, current_user: User = SuperAdmin):
    user = await _get_or_404(user_id, current_user.society_id, db)
    changes = body.model_dump(exclude_unset=True)
    if user.id == current_user.id and (
        changes.get("is_active") is False or changes.get("role", UserRole.super_admin) != UserRole.super_admin
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="You cannot deactivate yourself or remove your own admin role")
    if ("email" in changes or "phone" in changes) and not (
        changes.get("email", user.email) or changes.get("phone", user.phone)
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="A user needs an email or a phone number to log in")
    await _ensure_unique(db, changes.get("email"), changes.get("phone"), exclude_id=user.id)
    before = {k: getattr(user, k) for k in changes}
    for k, v in changes.items():
        setattr(user, k, v)
    await log_audit(db, current_user.society_id, current_user.id, "UPDATE", "User", user.id,
                    before=before, after=changes)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/reset-password", response_model=UserWithPassword)
async def reset_password(user_id: int, db: DB, current_user: User = SuperAdmin):
    user = await _get_or_404(user_id, current_user.society_id, db)
    password = _temporary_password()
    user.password_hash = hash_password(password)
    user.must_change_password = True
    user.temp_password_hash = None
    user.temp_password_expires_at = None
    await log_audit(db, current_user.society_id, current_user.id, "RESET_PASSWORD", "User", user.id)
    await db.commit()
    await db.refresh(user)
    return UserWithPassword(user=UserOut.model_validate(user), temporary_password=password)
