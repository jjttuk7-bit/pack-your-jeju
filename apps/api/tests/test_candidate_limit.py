import base64
import json
from datetime import datetime, timezone

import pytest

from apps.api.engine import search
from apps.api.engine import trust


def test_default_candidate_limit_is_five():
    assert search.DEFAULT_LIMIT == 5
    assert trust.judge_section.__kwdefaults__["limit"] == 5


def test_candidate_cursor_uses_a_stable_value_for_missing_updated_at():
    assert "COALESCE(updated_at" in search._CANDIDATE_PAGE_SELECT
    assert "COALESCE(updated_at" in search._CANDIDATE_CURSOR_CLAUSE


def test_candidate_pages_expose_total_and_do_not_overlap():
    candidates = [f"place-{index}" for index in range(12)]

    def fetch_page(_mf, *, cursor, limit):
        start = cursor.row_id if cursor else 0
        items = candidates[start : start + limit]
        next_index = start + len(items)
        return search.CandidateBatch(
            items=items,
            last_cursor=(
                search.CandidateCursor(1, 0, datetime(2026, 7, 13, tzinfo=timezone.utc), next_index)
                if items
                else None
            ),
            has_more=next_index < len(candidates),
        )

    first = search.search_candidate_page(
        object(),
        page_fn=fetch_page,
        count_fn=lambda _mf: len(candidates),
    )
    second = search.search_candidate_page(
        object(),
        cursor=first.next_cursor,
        page_fn=fetch_page,
        count_fn=lambda _mf: len(candidates),
    )

    assert first.items == candidates[:5]
    assert first.total_count == 12
    assert first.has_more is True
    assert first.next_cursor
    assert second.items == candidates[5:10]
    assert set(first.items).isdisjoint(second.items)


def test_keyset_cursor_ignores_new_rows_before_the_last_seen_key():
    rows = [(index, f"place-{index}") for index in range(1, 13)]
    count_calls = 0

    def fetch_page(_mf, *, cursor, limit):
        after_id = cursor.row_id if cursor else 0
        available = [row for row in rows if row[0] > after_id]
        visible = available[:limit]
        return search.CandidateBatch(
            items=[name for _, name in visible],
            last_cursor=(
                search.CandidateCursor(
                    1,
                    0,
                    datetime(2026, 7, 13, tzinfo=timezone.utc),
                    visible[-1][0],
                )
                if visible
                else None
            ),
            has_more=len(available) > limit,
        )

    def count_rows(_mf):
        nonlocal count_calls
        count_calls += 1
        return len(rows)

    first = search.search_candidate_page(object(), page_fn=fetch_page, count_fn=count_rows)
    rows.insert(0, (0, "new-before-cursor"))
    second = search.search_candidate_page(
        object(),
        cursor=first.next_cursor,
        page_fn=fetch_page,
        count_fn=count_rows,
    )

    assert first.items == [f"place-{index}" for index in range(1, 6)]
    assert second.items == [f"place-{index}" for index in range(6, 11)]
    assert second.total_count == 12
    assert count_calls == 1


def test_candidate_page_rejects_invalid_cursor():
    with pytest.raises(ValueError, match="cursor"):
        search.search_candidate_page(
            object(),
            cursor="not-a-valid-cursor",
            page_fn=lambda _mf, *, cursor, limit: search.CandidateBatch([], None, False),
            count_fn=lambda _mf: 0,
        )


def test_candidate_page_rejects_boolean_cursor_keys():
    cursor = search._encode_cursor(
        search.CandidateCursor(1, 0, datetime(2026, 7, 13, tzinfo=timezone.utc), 1),
    )
    decoded = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4))
    payload = json.loads(decoded)
    payload["id"] = True
    invalid = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")

    with pytest.raises(ValueError, match="cursor"):
        search.search_candidate_page(
            object(),
            cursor=invalid,
            page_fn=lambda _mf, *, cursor, limit: search.CandidateBatch([], None, False),
            count_fn=lambda _mf: 0,
        )
