from apps.api.engine import search
from apps.api.engine import trust


def test_default_candidate_limit_is_five():
    assert search.DEFAULT_LIMIT == 5
    assert trust.judge_section.__kwdefaults__["limit"] == 5
