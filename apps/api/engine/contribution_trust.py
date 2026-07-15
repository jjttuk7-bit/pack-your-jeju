from __future__ import annotations

from dataclasses import dataclass

INDEPENDENT_REPORTS_TO_OPEN_CASE = 2
REPORT_WINDOW_DAYS = 30
NEW_ACCOUNT_DAYS = 7
NEW_ACCOUNT_WEIGHT = 0.5
MAX_SUBMISSION_WEIGHT = 1.5


@dataclass(frozen=True)
class ContributionSignal:
    field_confidence_delta: float
    submission_weight: float
    public_warning: bool
    report_count: int
    independent_count: int
    verified_evidence: bool
    corroborating_source: bool


def build_signal(*, report_count: int, independent_count: int, verified_evidence: bool,
                 corroborating_source: bool, account_age_days: int) -> ContributionSignal:
    weight = NEW_ACCOUNT_WEIGHT if account_age_days < NEW_ACCOUNT_DAYS else 1.0
    if verified_evidence and account_age_days >= NEW_ACCOUNT_DAYS:
        weight = min(MAX_SUBMISSION_WEIGHT, weight + 0.25)
    delta = -0.1 * weight if report_count else 0.0
    opens = independent_count >= INDEPENDENT_REPORTS_TO_OPEN_CASE or (verified_evidence and corroborating_source)
    return ContributionSignal(delta, min(weight, MAX_SUBMISSION_WEIGHT), opens, report_count,
                              independent_count, verified_evidence, corroborating_source)


def should_open_case(signal: ContributionSignal) -> bool:
    return signal.independent_count >= INDEPENDENT_REPORTS_TO_OPEN_CASE or (
        signal.verified_evidence and signal.corroborating_source
    )
