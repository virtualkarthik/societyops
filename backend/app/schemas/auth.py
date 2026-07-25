from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    society_id: int
    name: str
    email: str
    phone: str | None
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}
