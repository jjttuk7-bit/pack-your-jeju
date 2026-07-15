from apps.api.engine.place_identity import PlaceCandidate, resolve_user_place


def test_exact_external_id_matches():
    result = resolve_user_place("성산일출봉", None, None, None, [PlaceCandidate(1, "성산일출봉", "제주 성산읍", None, None, "x1")])
    assert result.status == "matched"
    assert result.place_id == 1


def test_normalized_address_and_name_match():
    result = resolve_user_place(
        "  카페-바다 ", "제주특별자치도 제주시 애월읍 12", None, None,
        [PlaceCandidate(2, "카페 바다", "제주시 애월읍 12", None, None, None)],
    )
    assert result.status == "matched"
    assert result.place_id == 2


def test_ambiguous_same_name_waits_for_review():
    result = resolve_user_place(
        "바다카페", None, None, None,
        [
            PlaceCandidate(3, "바다카페", "제주시", 33.5, 126.5, None),
            PlaceCandidate(4, "바다카페", "서귀포시", 33.2, 126.6, None),
        ],
    )
    assert result.status == "needs_review"
    assert result.place_id is None


def test_unknown_place_becomes_new_candidate():
    result = resolve_user_place("새로운 장소", "제주시", None, None, [])
    assert result.status == "new_candidate"
