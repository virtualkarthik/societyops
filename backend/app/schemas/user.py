from typing import Optional
from pydantic import BaseModel, Field, field_validator

from app.models.user import UserRole
from app.schemas.auth import UserOut

MIN_PASSWORD_LENGTH = 8


def _normalize_email(v: str) -> str:
    v = v.strip().lower()
    if "@" not in v or v.startswith("@") or v.endswith("@"):
        raise ValueError("Invalid email address")
    return v


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(max_length=200)
    phone: Optional[str] = Field(default=None, max_length=20)
    role: UserRole

    _email = field_validator("email")(_normalize_email)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    phone: Optional[str] = Field(default=None, max_length=20)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserWithPassword(BaseModel):
    """Returned once, when a password is generated (create / reset)."""
    user: UserOut
    temporary_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=128)
