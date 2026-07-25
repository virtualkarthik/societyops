from datetime import date
from typing import Optional
from sqlalchemy import String, Text, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Society(Base):
    __tablename__ = "society"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(Text)
    builtup_area_sqm: Mapped[Optional[float]]
    cto_number: Mapped[Optional[str]] = mapped_column(String(100))
    cto_expiry: Mapped[Optional[date]] = mapped_column(Date)
    contact_email: Mapped[Optional[str]] = mapped_column(String(200))
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20))

    users: Mapped[list["User"]] = relationship(back_populates="society")  # noqa: F821
    assets: Mapped[list["Asset"]] = relationship(back_populates="society")  # noqa: F821
