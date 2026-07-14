from apps.api.engine.contribution_trust import (
    INDEPENDENT_REPORTS_TO_OPEN_CASE,
    build_signal,
    should_open_case,
)


def test_single_unverified_report_is_private_signal_only():
    signal = build_signal(report_count=1, independent_count=1, verified_evidence=False, corroborating_source=False, account_age_days=1)
    assert signal.field_confidence_delta < 0
    assert signal.public_warning is False
    assert should_open_case(signal) is False


def test_two_independent_reports_open_case():
    signal = build_signal(report_count=2, independent_count=2, verified_evidence=False, corroborating_source=False, account_age_days=30)
    assert INDEPENDENT_REPORTS_TO_OPEN_CASE == 2
    assert should_open_case(signal) is True


def test_verified_evidence_and_external_source_open_case():
    signal = build_signal(report_count=1, independent_count=1, verified_evidence=True, corroborating_source=True, account_age_days=30)
    assert should_open_case(signal) is True


def test_submission_weight_is_capped_and_new_accounts_are_limited():
    signal = build_signal(report_count=1, independent_count=1, verified_evidence=True, corroborating_source=False, account_age_days=1)
    assert signal.submission_weight == 0.5
    assert signal.submission_weight <= 1.5
