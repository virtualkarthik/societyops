from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from app.core.deps import CurrentUser, DB
from app.core.security import verify_password, create_access_token, hash_password
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.schemas.user import ChangePasswordRequest
from app.services.audit import log_audit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: DB):
    result = await db.execute(select(User).where(func.lower(User.email) == body.email.strip().lower(), User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id), "role": user.role, "society_id": user.society_id})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser):
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(body: ChangePasswordRequest, current_user: CurrentUser, db: DB):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current_user.password_hash = hash_password(body.new_password)
    await log_audit(db, current_user.society_id, current_user.id, "CHANGE_PASSWORD", "User", current_user.id)
    await db.commit()
