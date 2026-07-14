from apps.api.engine.moderation import ModerationSignal, evaluate_signals


def test_single_report_stays_private():
    result = evaluate_signals([ModerationSignal("정보 불일치")])
    assert result.open_case is False
    assert result.case_type is None


def test_two_independent_reports_open_mismatch_case():
    signals = [
        ModerationSignal("정보 불일치"), ModerationSignal("정보 불일치"),
    ]
    result = evaluate_signals(signals)
    assert result.open_case is True
    assert result.case_type == "info_mismatch"
    assert result.priority_rank >= 80


def test_verified_evidence_can_open_case_with_one_report():
    result = evaluate_signals([ModerationSignal("폐업 의심")], has_verified_evidence=True)
    assert result.open_case is True
    assert result.case_type == "closure_suspected"
