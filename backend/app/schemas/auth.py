from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class LoginRequest(BaseModel):
    login: str | None = None  # email or phone number
    email: str | None = None  # older app builds still send this
    password: str

    @property
    def identifier(self) -> str:
        return (self.login or self.email or "").strip()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    society_id: int
    name: str
    email: str | None
    phone: str | None
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class MeOut(UserOut):
    society_name: str | None = None


class BrandingOut(BaseModel):
    society_name: str | None
