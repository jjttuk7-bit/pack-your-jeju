from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

@dataclass(frozen=True)
class ModerationSignal:
    claim: str
    weight: float = 1.0


@dataclass(frozen=True)
class ModerationDecision:
    open_case: bool
    case_type: str | None
    priority: str
    priority_rank: int
    reason: str


def evaluate_signals(signals: Iterable[ModerationSignal], *, has_verified_evidence: bool = False) -> ModerationDecision:
    values = list(signals)
    independent = sum(signal.weight for signal in values)
    mismatch = any("정보 불일치" in signal.claim for signal in values)
    closure = any("폐업" in signal.claim or "운영" in signal.claim for signal in values)
    if independent < 2.0 and not (has_verified_evidence and values):
        return ModerationDecision(False, None, "low", 10, "single_or_low_confidence_signal")
    case_type = "closure_suspected" if closure else "info_mismatch" if mismatch else "evidence_conflict"
    rank = min(100, 40 + round(independent * 20) + (20 if has_verified_evidence else 0))
    priority = "urgent" if rank >= 80 else "high" if rank >= 60 else "normal"
    return ModerationDecision(True, case_type, priority, rank, "independent_signals_reached_threshold")
