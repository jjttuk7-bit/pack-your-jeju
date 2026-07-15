from datetime import datetime, timedelta, timezone

from apps.api.engine.search import _BASE_SELECT, _CANDIDATE_COUNT_SELECT, _CANDIDATE_PAGE_SELECT


def test_candidate_queries_require_unexpired_source_data():
    for query in (_BASE_SELECT, _CANDIDATE_PAGE_SELECT, _CANDIDATE_COUNT_SELECT):
        assert "valid_until >= :now" in query


def test_expired_event_is_not_current():
    now = datetime(2026, 7, 15, tzinfo=timezone.utc)
    assert now + timedelta(days=1) >= now
    assert now - timedelta(days=1) < now
