"""Tests for PPM next-due calculation across all frequency types."""
from datetime import date
import pytest
from app.models.ppm import PPMFrequency
from app.services.ppm import calc_next_due


class TestCalcNextDue:
    def test_daily(self):
        d = date(2024, 6, 15)
        assert calc_next_due(PPMFrequency.DAILY, None, d) == date(2024, 6, 16)

    def test_weekly(self):
        d = date(2024, 6, 15)
        assert calc_next_due(PPMFrequency.WEEKLY, None, d) == date(2024, 6, 22)

    def test_monthly(self):
        assert calc_next_due(PPMFrequency.MONTHLY, None, date(2024, 1, 15)) == date(2024, 2, 15)

    def test_monthly_end_of_month_clamp(self):
        # Jan 31 + 1 month = Feb 29 (2024 is leap year)
        assert calc_next_due(PPMFrequency.MONTHLY, None, date(2024, 1, 31)) == date(2024, 2, 29)

    def test_monthly_non_leap_year(self):
        # Jan 31 + 1 month in 2023 = Feb 28
        assert calc_next_due(PPMFrequency.MONTHLY, None, date(2023, 1, 31)) == date(2023, 2, 28)

    def test_quarterly(self):
        assert calc_next_due(PPMFrequency.QUARTERLY, None, date(2024, 1, 15)) == date(2024, 4, 15)

    def test_halfyearly(self):
        assert calc_next_due(PPMFrequency.HALFYEARLY, None, date(2024, 1, 15)) == date(2024, 7, 15)

    def test_yearly(self):
        assert calc_next_due(PPMFrequency.YEARLY, None, date(2024, 1, 15)) == date(2025, 1, 15)

    def test_custom_days_45(self):
        assert calc_next_due(PPMFrequency.CUSTOM_DAYS, 45, date(2024, 1, 1)) == date(2024, 2, 15)

    def test_custom_days_none_defaults_to_30(self):
        d = date(2024, 1, 1)
        result = calc_next_due(PPMFrequency.CUSTOM_DAYS, None, d)
        assert result == date(2024, 1, 31)

    def test_yearly_leap_to_non_leap(self):
        # Feb 29 2024 + 1 year = Feb 28 2025
        assert calc_next_due(PPMFrequency.YEARLY, None, date(2024, 2, 29)) == date(2025, 2, 28)
