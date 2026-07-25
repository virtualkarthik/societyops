from typing import Optional


def compute_removal_efficiency(inlet: Optional[float], outlet: Optional[float]) -> Optional[float]:
    """Compute BOD/COD/TSS removal efficiency as a percentage."""
    if inlet is None or outlet is None or inlet == 0:
        return None
    return round((inlet - outlet) / inlet * 100, 2)


def check_breach(
    outlet_bod: Optional[float],
    outlet_tss: Optional[float],
    ph: Optional[float],
    limits: dict,
) -> tuple[bool, list[str]]:
    """
    Check if lab test values breach configured TNPCB/CPCB limits.
    limits dict keys: bod_max, tss_max, ph_min, ph_max
    Returns (breach_flag, list of breach descriptions).
    """
    breaches: list[str] = []

    bod_max = limits.get("bod_max", 10.0)
    tss_max = limits.get("tss_max", 10.0)
    ph_min = limits.get("ph_min", 6.5)
    ph_max = limits.get("ph_max", 9.0)

    if outlet_bod is not None and outlet_bod > bod_max:
        breaches.append(f"BOD {outlet_bod} mg/L exceeds limit {bod_max} mg/L")

    if outlet_tss is not None and outlet_tss > tss_max:
        breaches.append(f"TSS {outlet_tss} mg/L exceeds limit {tss_max} mg/L")

    if ph is not None:
        if ph < ph_min:
            breaches.append(f"pH {ph} below minimum {ph_min}")
        elif ph > ph_max:
            breaches.append(f"pH {ph} exceeds maximum {ph_max}")

    return bool(breaches), breaches
