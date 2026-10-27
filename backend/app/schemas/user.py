from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.identity import normalize_email, normalize_phone
from app.models.user import UserRole
from app.schemas.auth import UserOut

MIN_PASSWORD_LENGTH = 8


def _email_or_none(v: Optional[str]) -> Optional[str]:
    return normalize_email(v) if v and v.strip() else None


def _phone_or_none(v: Optional[str]) -> Optional[str]:
    return normalize_phone(v) if v and v.strip() else None


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: Optional[str] = Field(default=None, max_length=200)
    phone: Optional[str] = Field(default=None, max_length=30)
    role: UserRole

    _email = field_validator("email")(_email_or_none)
    _phone = field_validator("phone")(_phone_or_none)

    @model_validator(mode="after")
    def _needs_login_identifier(self):
        if not self.email and not self.phone:
            raise ValueError("Enter an email or a phone number so the user can log in")
        return self


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    email: Optional[str] = Field(default=None, max_length=200)
    phone: Optional[str] = Field(default=None, max_length=30)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

    _email = field_validator("email")(_email_or_none)
    _phone = field_validator("phone")(_phone_or_none)


class UserWithPassword(BaseModel):
    """Returned once, when a password is generated (create / reset)."""
    user: UserOut
    temporary_password: str


class ChangePasswordRequest(BaseModel):
    # Not required while must_change_password is set: the user has just
    # authenticated with the temporary password.
    current_password: Optional[str] = None
    new_password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=128)
