from datetime import date, timedelta
from typing import Optional
from app.models.ppm import PPMFrequency


def calc_next_due(
    frequency: PPMFrequency,
    custom_interval_days: Optional[int],
    from_date: date,
) -> date:
    """Calculate the next due date for a PPM task based on frequency."""
    if frequency == PPMFrequency.DAILY:
        return from_date + timedelta(days=1)
    if frequency == PPMFrequency.WEEKLY:
        return from_date + timedelta(weeks=1)
    if frequency == PPMFrequency.MONTHLY:
        return _add_months(from_date, 1)
    if frequency == PPMFrequency.QUARTERLY:
        return _add_months(from_date, 3)
    if frequency == PPMFrequency.HALFYEARLY:
        return _add_months(from_date, 6)
    if frequency == PPMFrequency.YEARLY:
        return _add_months(from_date, 12)
    if frequency == PPMFrequency.CUSTOM_DAYS:
        days = custom_interval_days or 30
        return from_date + timedelta(days=days)
    return from_date + timedelta(days=30)


def _add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    # Clamp day to last day of month
    import calendar
    last_day = calendar.monthrange(year, month)[1]
    day = min(d.day, last_day)
    return date(year, month, day)
