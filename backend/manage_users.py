"""
User admin CLI (the app has no user-management UI yet).

    python manage_users.py list
    python manage_users.py add --email op@x.in --name "Ravi" --role operator [--phone ...]
    python manage_users.py reset-password --email op@x.in
    python manage_users.py deactivate --email op@x.in

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


def get_user(session: Session, email: str) -> User:
    user = session.scalar(select(User).where(User.email == email))
    if user is None:
        sys.exit(f"No user with email {email}")
    return user


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    add = sub.add_parser("add")
    add.add_argument("--email", required=True)
    add.add_argument("--name", required=True)
    add.add_argument("--role", required=True, choices=[r.value for r in UserRole])
    add.add_argument("--phone")
    add.add_argument("--society-id", type=int)
    for name in ("reset-password", "deactivate"):
        sub.add_parser(name).add_argument("--email", required=True)
    args = parser.parse_args()

    engine = create_engine(settings.DATABASE_URL_SYNC)
    with Session(engine) as session:
        if args.cmd == "list":
            for u in session.scalars(select(User).order_by(User.society_id, User.role, User.email)):
                status = "active" if u.is_active else "inactive"
                print(f"{u.society_id}\t{u.role.value:<12}\t{status:<8}\t{u.email}\t{u.name}")
            return

        password = None
        if args.cmd == "add":
            if session.scalar(select(User).where(User.email == args.email)):
                sys.exit(f"User {args.email} already exists")
            password = secrets.token_urlsafe(9)
            session.add(User(society_id=resolve_society_id(session, args.society_id),
                             name=args.name, email=args.email, phone=args.phone,
                             role=UserRole(args.role), password_hash=hash_password(password)))
        elif args.cmd == "reset-password":
            password = secrets.token_urlsafe(9)
            get_user(session, args.email).password_hash = hash_password(password)
        elif args.cmd == "deactivate":
            get_user(session, args.email).is_active = False
        session.commit()

    print(f"{args.cmd}: {args.email} OK")
    if password:
        print(f"PASSWORD={password}")


if __name__ == "__main__":
    main()
