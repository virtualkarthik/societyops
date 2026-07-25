"""Tests for STP compliance logic: removal efficiency and breach flagging."""
import pytest
from app.services.compliance import compute_removal_efficiency, check_breach

DEFAULT_LIMITS = {"bod_max": 10.0, "tss_max": 10.0, "ph_min": 6.5, "ph_max": 9.0}


class TestRemovalEfficiency:
    def test_standard_case(self):
        result = compute_removal_efficiency(inlet=150.0, outlet=8.0)
        assert result == pytest.approx(94.67, abs=0.01)

    def test_perfect_removal(self):
        assert compute_removal_efficiency(100.0, 0.0) == pytest.approx(100.0)

    def test_no_removal(self):
        assert compute_removal_efficiency(100.0, 100.0) == pytest.approx(0.0)

    def test_zero_inlet_returns_none(self):
        assert compute_removal_efficiency(0.0, 5.0) is None

    def test_none_inlet_returns_none(self):
        assert compute_removal_efficiency(None, 5.0) is None

    def test_none_outlet_returns_none(self):
        assert compute_removal_efficiency(150.0, None) is None

    def test_both_none_returns_none(self):
        assert compute_removal_efficiency(None, None) is None


class TestBreachFlagging:
    def test_no_breach_all_ok(self):
        flag, details = check_breach(outlet_bod=8.0, outlet_tss=8.0, ph=7.5, limits=DEFAULT_LIMITS)
        assert flag is False
        assert details == []

    def test_bod_breach(self):
        flag, details = check_breach(outlet_bod=12.0, outlet_tss=8.0, ph=7.5, limits=DEFAULT_LIMITS)
        assert flag is True
        assert any("BOD" in d for d in details)

    def test_tss_breach(self):
        flag, details = check_breach(outlet_bod=8.0, outlet_tss=15.0, ph=7.5, limits=DEFAULT_LIMITS)
        assert flag is True
        assert any("TSS" in d for d in details)

    def test_ph_too_low(self):
        flag, details = check_breach(outlet_bod=8.0, outlet_tss=8.0, ph=5.9, limits=DEFAULT_LIMITS)
        assert flag is True
        assert any("pH" in d for d in details)

    def test_ph_too_high(self):
        flag, details = check_breach(outlet_bod=8.0, outlet_tss=8.0, ph=9.5, limits=DEFAULT_LIMITS)
        assert flag is True
        assert any("pH" in d for d in details)

    def test_ph_at_boundary_ok(self):
        flag, _ = check_breach(outlet_bod=8.0, outlet_tss=8.0, ph=6.5, limits=DEFAULT_LIMITS)
        assert flag is False
        flag2, _ = check_breach(outlet_bod=8.0, outlet_tss=8.0, ph=9.0, limits=DEFAULT_LIMITS)
        assert flag2 is False

    def test_multiple_breaches(self):
        flag, details = check_breach(outlet_bod=20.0, outlet_tss=25.0, ph=10.0, limits=DEFAULT_LIMITS)
        assert flag is True
        assert len(details) == 3

    def test_none_values_skipped(self):
        flag, details = check_breach(outlet_bod=None, outlet_tss=None, ph=None, limits=DEFAULT_LIMITS)
        assert flag is False
        assert details == []

    def test_custom_limits(self):
        limits = {"bod_max": 30.0, "tss_max": 30.0, "ph_min": 6.0, "ph_max": 10.0}
        flag, _ = check_breach(outlet_bod=25.0, outlet_tss=25.0, ph=9.5, limits=limits)
        assert flag is False
