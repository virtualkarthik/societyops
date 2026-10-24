"""Normalisation for the two login identifiers (email, phone)."""
import re

DEFAULT_COUNTRY_CODE = "91"  # bare 10-digit numbers are Indian mobiles


def normalize_email(raw: str) -> str:
    email = raw.strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise ValueError("Invalid email address")
    return email


def normalize_phone(raw: str) -> str:
    """'98765 43210', '098765-43210', '+91 98765 43210' -> '+919876543210'."""
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) == 10:
        digits = DEFAULT_COUNTRY_CODE + digits
    if not 11 <= len(digits) <= 15:
        raise ValueError("Invalid phone number")
    return "+" + digits


def is_email(identifier: str) -> bool:
    return "@" in identifier
