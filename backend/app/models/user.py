import enum
from typing import Optional
from sqlalchemy import String, Enum, ForeignKey, Index, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    committee = "committee"
    operator = "operator"
    resident = "resident"


class User(Base):
    __tablename__ = "user"
    __table_args__ = (
        Index("ix_user_society", "society_id"),
        # Operators often have no email, so a user logs in with either identifier.
        CheckConstraint("email IS NOT NULL OR phone IS NOT NULL", name="ck_user_email_or_phone"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    society_id: Mapped[int] = mapped_column(ForeignKey("society.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(200), unique=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), unique=True)  # normalised, e.g. +919876543210
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)

    society: Mapped["Society"] = relationship(back_populates="users")  # noqa: F821
