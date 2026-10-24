"""
User admin CLI for recovery over SSH (day-to-day: the Users page in the app).

    python manage_users.py list
    python manage_users.py add --name "Ravi" --role operator --phone 9876543210 [--email op@x.in]
    python manage_users.py reset-password --user 9876543210      (email or phone)
    python manage_users.py deactivate --user op@x.in

New users join the only society on the instance (or pass --society-id).
Generated passwords are printed once.
"""
import argparse
import os
import secrets
import sys

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.identity import is_email, normalize_email, normalize_phone
from app.core.security import hash_password
from app.models.society import Society
from app.models.user import User, UserRole


def resolve_society_id(session: Session, society_id: int | None) -> int:
    if society_id is not None:
        return society_id
    ids = list(session.scalars(select(Society.id)))
    if len(ids) != 1:
        sys.exit(f"{len(ids)} societies on this instance; pass --society-id")
    return ids[0]


def get_user(session: Session, identifier: str) -> User:
    if is_email(identifier):
        clause = User.email == normalize_email(identifier)
    else:
        clause = User.phone == normalize_phone(identifier)
    user = session.scalar(select(User).where(clause))
    if user is None:
        sys.exit(f"No user with email/phone {identifier}")
    return user


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    add = sub.add_parser("add")
    add.add_argument("--email")
    add.add_argument("--name", required=True)
    add.add_argument("--role", required=True, choices=[r.value for r in UserRole])
    add.add_argument("--phone")
    add.add_argument("--society-id", type=int)
    for name in ("reset-password", "deactivate"):
        sub.add_parser(name).add_argument("--user", required=True, help="email or phone")
    args = parser.parse_args()

    engine = create_engine(settings.DATABASE_URL_SYNC)
    with Session(engine) as session:
        if args.cmd == "list":
            for u in session.scalars(select(User).order_by(User.society_id, User.role, User.email)):
                status = "active" if u.is_active else "inactive"
                print(f"{u.society_id}\t{u.role.value:<12}\t{status:<8}\t{u.email or '-'}\t{u.phone or '-'}\t{u.name}")
            return

        password = None
        if args.cmd == "add":
            email = normalize_email(args.email) if args.email else None
            phone = normalize_phone(args.phone) if args.phone else None
            if not email and not phone:
                sys.exit("Pass --email and/or --phone")
            if (email and session.scalar(select(User).where(User.email == email))) or \
                    (phone and session.scalar(select(User).where(User.phone == phone))):
                sys.exit("A user with this email/phone already exists")
            password = secrets.token_urlsafe(9)
            session.add(User(society_id=resolve_society_id(session, args.society_id),
                             name=args.name, email=email, phone=phone,
                             role=UserRole(args.role), password_hash=hash_password(password)))
        elif args.cmd == "reset-password":
            password = secrets.token_urlsafe(9)
            get_user(session, args.user).password_hash = hash_password(password)
        elif args.cmd == "deactivate":
            get_user(session, args.user).is_active = False
        session.commit()

    print(f"{args.cmd}: {getattr(args, 'user', None) or args.email or args.phone} OK")
    if password:
        print(f"PASSWORD={password}")


if __name__ == "__main__":
    main()
