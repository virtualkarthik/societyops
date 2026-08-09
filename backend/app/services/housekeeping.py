from datetime import date, timedelta
from typing import Optional
from app.models.housekeeping import HousekeepingFrequency


def calc_next_due(frequency: HousekeepingFrequency, custom_interval_days: Optional[int], from_date: date) -> date:
    if frequency == HousekeepingFrequency.DAILY:
        return from_date + timedelta(days=1)
    if frequency == HousekeepingFrequency.ALTERNATE_DAYS:
        return from_date + timedelta(days=2)
    if frequency == HousekeepingFrequency.WEEKLY:
        return from_date + timedelta(days=7)
    if frequency == HousekeepingFrequency.FORTNIGHTLY:
        return from_date + timedelta(days=14)
    if frequency == HousekeepingFrequency.CUSTOM_DAYS:
        return from_date + timedelta(days=custom_interval_days or 1)
    return from_date + timedelta(days=1)
