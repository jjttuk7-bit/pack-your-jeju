from apps.api.engine.feedback_ledger import record_moderation_signal
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


class _Result:
    def __init__(self, rows=(), first=None):
        self.rows, self._first = rows, first

    def fetchall(self):
        return list(self.rows)

    def first(self):
        return self._first


class _Conn:
    def __init__(self):
        self.sql = []

    def execute(self, statement, params):
        query = str(statement)
        self.sql.append((query, params))
        if "SELECT author_id" in query:
            return _Result(rows=[("u1", 1.0), ("u2", 1.0)])
        if "SELECT id FROM moderation_case" in query:
            return _Result(first=None)
        return _Result()


def test_record_signal_updates_profile_and_opens_case_after_two_reports():
    conn = _Conn()
    record_moderation_signal(conn, place_id=42, author_id="u3", payload={"mismatch_types": ["정보 불일치"]})
    queries = "\n".join(query for query, _ in conn.sql)
    assert "place_trust_profile" in queries
    assert "INSERT INTO moderation_case" in queries
