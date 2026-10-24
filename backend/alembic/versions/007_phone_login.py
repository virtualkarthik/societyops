"""Allow phone-number login: email optional, phone normalised + unique

Revision ID: 007
Revises: 006
Create Date: 2026-10-25 00:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Same rules as app.core.identity.normalize_phone: strip non-digits, drop a
    # leading trunk 0, prefix 91 to bare 10-digit numbers, store as +<digits>.
    op.execute("""
        UPDATE "user" SET phone = NULLIF(regexp_replace(phone, '\\D', '', 'g'), '') WHERE phone IS NOT NULL
    """)
    op.execute("""
        UPDATE "user" SET phone = substr(phone, 2) WHERE length(phone) = 11 AND phone LIKE '0%'
    """)
    op.execute("""
        UPDATE "user" SET phone = '91' || phone WHERE length(phone) = 10
    """)
    op.execute("""
        UPDATE "user" SET phone = CASE WHEN length(phone) BETWEEN 11 AND 15 THEN '+' || phone END
        WHERE phone IS NOT NULL
    """)
    op.alter_column("user", "email", existing_type=sa.String(200), nullable=True)
    op.create_unique_constraint("user_phone_key", "user", ["phone"])
    op.create_check_constraint("ck_user_email_or_phone", "user", "email IS NOT NULL OR phone IS NOT NULL")


def downgrade() -> None:
    # Fails while phone-only users exist: give them an email (or delete them) first.
    op.drop_constraint("ck_user_email_or_phone", "user", type_="check")
    op.drop_constraint("user_phone_key", "user", type_="unique")
    op.alter_column("user", "email", existing_type=sa.String(200), nullable=False)
