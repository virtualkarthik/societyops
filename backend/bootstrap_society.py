"""
Production bootstrap: creates one society, its first super_admin, and the
default TNPCB/CPCB compliance limits. No demo data. Safe to re-run: an
existing society/admin is left untouched.

Usage:
    python bootstrap_society.py --society "Opera Apartments" \
        --admin-email you@example.com --admin-name "Your Name"

Prints the generated admin password once (only when the admin is created).
"""
import argparse
import os
import secrets
import sys

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.society import Society
from app.models.user import User, UserRole
from app.models.stp import ComplianceLimit

DEFAULT_LIMITS = [
    dict(parameter="bod", max_value=10.0, unit="mg/L", description="TNPCB BOD outlet limit"),
    dict(parameter="tss", max_value=10.0, unit="mg/L", description="TNPCB TSS outlet limit"),
    dict(parameter="ph", min_value=6.5, max_value=9.0, description="TNPCB pH acceptable range"),
    dict(parameter="cod", max_value=50.0, unit="mg/L", description="CPCB COD outlet limit"),
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--society", required=True)
    parser.add_argument("--address")
    parser.add_argument("--admin-email", required=True)
    parser.add_argument("--admin-name", default="Administrator")
    args = parser.parse_args()

    engine = create_engine(settings.DATABASE_URL_SYNC)
    with Session(engine) as session:
        society = session.scalar(select(Society).where(Society.name == args.society))
        if society is None:
            society = Society(name=args.society, address=args.address,
                              contact_email=args.admin_email)
            session.add(society)
            session.flush()
            print(f"Created society '{society.name}' (id={society.id})")
        else:
            print(f"Society '{society.name}' already exists (id={society.id})")

        existing_params = set(session.scalars(
            select(ComplianceLimit.parameter).where(ComplianceLimit.society_id == society.id)
        ))
        for lim in DEFAULT_LIMITS:
            if lim["parameter"] not in existing_params:
                session.add(ComplianceLimit(society_id=society.id, **lim))

        admin = session.scalar(select(User).where(User.email == args.admin_email))
        password = None
        if admin is None:
            password = secrets.token_urlsafe(12)
            session.add(User(society_id=society.id, name=args.admin_name,
                             email=args.admin_email, role=UserRole.super_admin,
                             password_hash=hash_password(password)))
        elif admin.society_id != society.id:
            sys.exit(f"User {args.admin_email} already belongs to another society")

        session.commit()

    if password:
        print(f"Created super_admin {args.admin_email}")
        print(f"ADMIN_PASSWORD={password}")
    else:
        print(f"super_admin {args.admin_email} already exists; password unchanged")


if __name__ == "__main__":
    main()
