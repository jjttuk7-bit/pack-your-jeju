import json
from datetime import date

from apps.api.engine import haruban


def test_haruban_prompt_frames_web_research_agent():
    prompt = haruban._BASE_SYSTEM_PROMPT
    assert "gpt-5-mini" in prompt
    assert "도구" in prompt
    assert "total_count" in prompt
    assert "이전 대화 맥락" in prompt
    assert "웹 리서치" in prompt
    assert "공공데이터 교차확인" in prompt
    assert "저희 DB/RAG 검색 기준" not in prompt


def test_haruban_prompt_uses_web_research_answer_contract():
    prompt = haruban._BASE_SYSTEM_PROMPT

    assert "카카오·네이버·블로그 리뷰를 근거로 삼지 마라" not in prompt
    assert "정보가 없으면 '저희가 참조하는 공공데이터 기준" not in prompt
    for phrase in ("직접 결론", "후보별", "비교", "주의", "출처", "공공데이터 교차확인"):
        assert phrase in prompt


def test_search_places_tool_supports_count_questions():
    tool = next(t for t in haruban.TOOLS if t["function"]["name"] == "search_places")
    description = tool["function"]["description"]
    assert "몇 개" in description
    assert "총 개수" in description
    assert "공공데이터 근거" in description


def test_haruban_tools_include_unlocked_agent_capabilities():
    tool_names = {t["function"]["name"] for t in haruban.TOOLS}

    assert "build_pack" in tool_names
    assert "verify_review" in tool_names
    assert "preview_region_coverage" in tool_names
    assert "suggest_form_augment" in tool_names
    assert "web_search_jeju" in tool_names


def test_web_search_jeju_tool_requires_query_and_returns_sources():
    tool = next(t for t in haruban.TOOLS if t["function"]["name"] == "web_search_jeju")
    props = tool["function"]["parameters"]["properties"]

    assert "query" in props
    assert "sources" in tool["function"]["description"]
    assert "최신" in tool["function"]["description"]


def test_build_pack_tool_requires_form_state():
    tool = next(t for t in haruban.TOOLS if t["function"]["name"] == "build_pack")
    props = tool["function"]["parameters"]["properties"]

    assert "form_state" in props
    assert "여행팩" in tool["function"]["description"]
    assert "공공데이터" in tool["function"]["description"]


def test_haruban_build_pack_runner_summarizes_pack(monkeypatch):
    class FakeReq:
        regions = ["seongsan"]
        moments = ["local_food"]
        companion = "solo"
        purpose = "food"
        days = 2
        start_date = date(2026, 7, 10)

    class FakeFilterBundle:
        per_moment = ["fake-filter"]

    class FakeIntro:
        text = "성산 현지 맛집 중심으로 조립했어요."
        llm_used = False

    class FakeItem:
        name = "소심한이층"
        badge = "verified"
        note = ""
        address = "서귀포시 성산읍"

    class FakeSection:
        moment = "local_food"
        items = [FakeItem()]
        fallback = None
        observed_reasons = []

    monkeypatch.setattr(haruban.filters_mod.PackRequest, "from_dict", lambda _: FakeReq())
    monkeypatch.setattr(haruban.filters_mod, "build_filters", lambda _: FakeFilterBundle())
    monkeypatch.setattr(
        haruban.weather_mod,
        "smoke_kma_nowcast",
        lambda *a, **k: {"available": True, "summary": "바람 확인"},
    )
    monkeypatch.setattr(haruban.trust_mod, "judge_section", lambda *a, **k: FakeSection())
    monkeypatch.setattr(haruban.assemble_mod, "compose_intro", lambda *a, **k: FakeIntro())
    monkeypatch.setattr(
        haruban.assemble_mod,
        "dispatch_itinerary",
        lambda *a, **k: [{"day": 1, "items": []}],
    )

    result = haruban._run_build_pack({"form_state": {"regions": ["seongsan"]}})

    assert result["available"] is True
    assert result["intro"]["text"] == "성산 현지 맛집 중심으로 조립했어요."
    assert result["sections"][0]["items"][0]["name"] == "소심한이층"
    assert result["weather"]["summary"] == "바람 확인"


def test_haruban_verify_review_runner_serializes_claims(monkeypatch):
    class FakeClaim:
        text = "A 식당은 폐업했다."
        verdict = "contradicted"
        fallback_reason = "contradicted"
        matched_name = "A 식당"
        matched_external_id = "v1"
        reason = "수정요청에서 폐업 신호가 확인됩니다."
        sources = ["visitjeju"]

    monkeypatch.setattr(haruban.verify_mod, "verify_text", lambda text: [FakeClaim()])

    result = haruban._run_verify_review({"text": "A 식당은 폐업했다."})

    assert result["claims"][0]["verdict"] == "contradicted"
    assert result["claims"][0]["matched_name"] == "A 식당"
    assert result["claims"][0]["sources"] == ["visitjeju"]


def test_haruban_region_coverage_runner_handles_multiple_regions(monkeypatch):
    monkeypatch.setattr(
        haruban.region_coverage_mod,
        "build_region_preview",
        lambda region: {"region": region, "moments": [{"moment": "beach_walk", "count": 4}]},
    )

    result = haruban._run_preview_region_coverage({"regions": ["seongsan", "gujwa"]})

    assert [r["region"] for r in result["regions"]] == ["seongsan", "gujwa"]


def test_haruban_web_search_runner_serializes_sources(monkeypatch):
    class FakeWebResult:
        available = True
        answer = "제주시에서는 원도심 산책과 해안 드라이브를 함께 보기 좋습니다."
        sources = [
            {"title": "Visit Jeju", "url": "https://www.visitjeju.net/", "snippet": "제주시 여행 정보"},
        ]
        query = "제주시 요즘 가볼만한 곳"
        reason = ""

    monkeypatch.setattr(haruban, "_perform_web_search_jeju", lambda query, context="": FakeWebResult())

    result = haruban._run_web_search_jeju({
        "query": "제주시 요즘 가볼만한 곳",
        "context": "처음 제주",
    })

    assert result["available"] is True
    assert result["source_type"] == "web"
    assert result["answer"].startswith("제주시")
    assert result["sources"][0]["url"] == "https://www.visitjeju.net/"


def test_build_web_search_plan_covers_source_roles():
    plan = haruban._build_web_search_plan("구좌 맛집 추천", "혼자 점심")

    assert 2 <= len(plan) <= 3
    assert {item["source_class"] for item in plan} >= {"official", "experience"}
    assert len({item["query"] for item in plan}) == len(plan)
    assert all("구좌" in item["query"] for item in plan)


def test_dedupe_sources_adds_class_and_checked_at():
    sources = haruban._dedupe_sources([
        {
            "title": "비짓제주",
            "url": "https://www.visitjeju.net/kr/detail/view?contentsid=1",
        },
        {
            "title": "비짓제주 중복",
            "url": "https://www.visitjeju.net/kr/detail/view?contentsid=1",
        },
    ])

    assert len(sources) == 1
    assert sources[0]["source_class"] == "official"
    assert sources[0]["checked_at"]


def test_web_research_merges_partial_results(monkeypatch):
    plan = [
        {"source_class": "official", "query": "구좌 오름 공식"},
        {"source_class": "platform", "query": "구좌 오름 지도"},
        {"source_class": "experience", "query": "구좌 오름 후기"},
    ]
    monkeypatch.setattr(haruban, "_build_web_search_plan", lambda query, context="": plan)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    def fake_single(query, context="", source_class="web"):
        if source_class == "official":
            return haruban.WebSearchResult(
                available=True,
                query=query,
                answer="공식 출처에서 구좌 오름 정보를 확인했습니다.",
                sources=[{"title": "비짓제주", "url": "https://www.visitjeju.net/oreum"}],
            )
        return haruban.WebSearchResult(available=False, query=query, reason="no usable result")

    monkeypatch.setattr(haruban, "_perform_single_web_search", fake_single, raising=False)

    result = haruban._perform_web_search_jeju("구좌 오름 추천")

    assert result.available is True
    assert result.research_status == "partial"
    assert result.queries == [item["query"] for item in plan]
    assert len(result.sources) == 1


def test_web_research_retries_once_when_all_planned_queries_are_empty(monkeypatch):
    plan = [
        {"source_class": "official", "query": "구좌 맛집 공식"},
        {"source_class": "experience", "query": "구좌 맛집 후기"},
    ]
    calls = []
    monkeypatch.setattr(haruban, "_build_web_search_plan", lambda query, context="": plan)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    def fake_single(query, context="", source_class="web"):
        calls.append(query)
        return haruban.WebSearchResult(available=False, query=query, reason="empty")

    monkeypatch.setattr(haruban, "_perform_single_web_search", fake_single, raising=False)

    result = haruban._perform_web_search_jeju("구좌에서 가장 맛집은?")

    assert result.available is False
    assert result.research_status == "unavailable"
    assert len(calls) == 3
    assert calls[-1] == "구좌에서 가장 맛집은?"


def test_haruban_routes_fresh_broad_question_to_web_search(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "요즘 제주시 여행은 원도심과 바다 산책을 같이 보기 좋습니다.",
            "sources": [{"title": "Visit Jeju", "url": "https://www.visitjeju.net/"}],
            "source_type": "web",
        },
    )

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "제주가 처음인데 요즘 제주시의 가볼만한 곳들은?"}],
        {},
    )

    assert result["tool"] == "web_search_jeju"
    assert "요즘" in result["args"]["query"]
    assert result["result"]["sources"][0]["title"] == "Visit Jeju"


def test_web_failure_fallback_does_not_substitute_public_data_candidates():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "구좌에서 가장 맛집은?"},
        {
            "role": "tool",
            "name": "web_search_jeju",
            "content": json.dumps({
                "available": False,
                "research_status": "unavailable",
                "reason": "web search returned no usable source",
                "sources": [],
            }, ensure_ascii=False),
        },
    ])

    assert "웹 출처" in reply
    assert "지역이나 순간을 하나 고르면" not in reply
    assert "공공데이터 후보" not in reply


def test_generic_fallback_does_not_default_to_public_data_mode():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "구좌 여행을 더 알아보고 싶어"},
    ])

    assert "공공데이터 기준으로 다시 좁혀" not in reply
    assert "웹" in reply


def test_partial_web_fallback_discloses_partial_result_and_source_role():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "구좌 오름을 알려줘"},
        {
            "role": "tool",
            "name": "web_search_jeju",
            "content": json.dumps({
                "available": True,
                "research_status": "partial",
                "answer": "공식 출처에서 구좌 오름 한 곳을 확인했습니다.",
                "sources": [{
                    "title": "제주 안내",
                    "url": "https://example.go.kr/oreum",
                    "source_class": "official",
                }],
            }, ensure_ascii=False),
        },
    ])

    assert "일부" in reply
    assert "공식" in reply
    assert reply.count("https://example.go.kr/oreum") == 1


def test_haruban_keeps_web_intent_for_oreum_followup(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "구좌 오름을 웹 출처로 확인했습니다.",
            "sources": [{"title": "Visit Jeju", "url": "https://www.visitjeju.net/"}],
            "source_type": "web",
        },
    )
    conv = [
        {"role": "user", "content": "구좌에서 가볼 만한 지역들을 알려줘"},
        {"role": "assistant", "content": "웹 출처를 확인해 구좌를 정리했습니다."},
        {"role": "user", "content": "구좌의 오름들 정보는?"},
    ]

    result = haruban._build_search_pool_context(conv, {})

    assert result["tool"] == "web_search_jeju"
    assert "오름" in result["args"]["query"]


def test_haruban_keeps_web_intent_for_restaurant_followup(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "구좌 맛집을 웹 출처로 확인했습니다.",
            "sources": [{"title": "지역 매체", "url": "https://example.com/gujwa"}],
            "source_type": "web",
        },
    )
    conv = [
        {"role": "user", "content": "구좌에서 가볼 만한 지역들을 알려줘"},
        {"role": "assistant", "content": "웹 출처를 확인해 구좌를 정리했습니다."},
        {"role": "user", "content": "구좌에서 가장 맛집은?"},
    ]

    result = haruban._build_search_pool_context(conv, {})

    assert result["tool"] == "web_search_jeju"
    assert "맛집" in result["args"]["query"]


def test_haruban_routes_direct_restaurant_recommendation_to_web(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "제주시 맛집을 웹 출처로 비교했습니다.",
            "sources": [{"title": "지역 매체", "url": "https://example.com/jeju"}],
            "source_type": "web",
        },
    )

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "제주시 맛집 한 곳 추천해줘"}],
        {},
    )

    assert result["tool"] == "web_search_jeju"


def test_explicit_public_data_request_still_routes_to_search_places(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_search_places",
        lambda args: {
            "intent": args.get("intent"),
            "total_count": 2,
            "regions": args.get("regions"),
            "category": args.get("category"),
            "items": [{"name": "안돌오름", "address": "제주시 구좌읍"}],
        },
    )

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "공공데이터 기준으로 구좌 오름 후보 수를 알려줘"}],
        {},
    )

    assert result["tool"] == "search_places"


def test_haruban_routes_airport_region_question_to_web_search(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "제주공항은 제주시 용담동 일대에 있습니다.",
            "sources": [{"title": "한국공항공사", "url": "https://www.airport.co.kr/jeju/"}],
            "source_type": "web",
        },
    )
    conv = [{"role": "user", "content": "제주공항은 어느 지역에 있어?"}]

    assert haruban._infer_place_detail_query(conv) == ""
    result = haruban._build_search_pool_context(conv, {})

    assert result["tool"] == "web_search_jeju"
    assert "제주공항" in result["args"]["query"]
    assert result["result"]["sources"][0]["title"] == "한국공항공사"


def test_haruban_answers_airport_region_without_api_key(monkeypatch):
    monkeypatch.setattr(haruban.llm, "is_available", lambda: False)

    result = haruban.chat_turn(
        [{"role": "user", "content": "제주공항은 어느 지역에 있어?"}],
        {},
    )

    assert result.available is True
    assert "제주시" in result.reply_text
    assert "공항" in result.reply_text
    assert "호텔" not in result.reply_text
    assert "웹에서 바로 확인" not in result.reply_text


def test_haruban_answers_first_jeju_region_guide_without_api_key(monkeypatch):
    monkeypatch.setattr(haruban.llm, "is_available", lambda: False)

    result = haruban.chat_turn(
        [{"role": "user", "content": "제주는 처음인데 어떤 지역이 좋아?"}],
        {},
    )

    assert result.available is True
    assert "제주시" in result.reply_text
    assert "성산" in result.reply_text
    assert "애월" in result.reply_text
    assert "공공데이터" in result.reply_text


def test_haruban_answers_broad_jeju_city_guide_without_api_key(monkeypatch):
    monkeypatch.setattr(haruban.llm, "is_available", lambda: False)

    result = haruban.chat_turn(
        [{"role": "user", "content": "제주시를 처음 보면 어떤 흐름이 좋아?"}],
        {},
    )

    assert result.available is True
    assert "공항" in result.reply_text
    assert "원도심" in result.reply_text
    assert "장소" in result.reply_text


def test_haruban_general_question_router_sends_place_recommendations_to_web(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "제주시 맛집 한 곳을 웹 출처로 비교했습니다.",
            "sources": [{"title": "지역 매체", "url": "https://example.com/jeju"}],
            "source_type": "web",
        },
    )
    monkeypatch.setattr(haruban.llm, "is_available", lambda: False)

    result = haruban.chat_turn(
        [{"role": "user", "content": "제주시 맛집 한 곳 추천해줘"}],
        {},
    )

    assert "웹 출처" in result.reply_text
    assert "공공데이터 기준 후보" not in result.reply_text


def test_haruban_general_question_has_answer_contract(monkeypatch):
    monkeypatch.setattr(haruban.llm, "is_available", lambda: False)

    result = haruban.chat_turn(
        [{"role": "user", "content": "제주공항은 어느 지역에 있어?"}],
        {},
    )

    assert result.answer_contract == {
        "answer_type": "general_knowledge",
        "source_type": "stable_general",
        "confidence": "medium",
        "requires_tool": False,
        "limitations": ["장소·운영시간·요금은 별도 근거 확인 필요"],
    }


def test_haruban_search_pool_contract_for_weather(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_weather_signal",
        lambda form_state: {"available": True, "region_label": "제주시", "labels": ["비 확인"]},
    )

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "여행 기간 날씨는 어때?"}],
        {"regions": ["jeju_city"]},
    )

    assert result["contract"]["answer_type"] == "weather"
    assert result["contract"]["source_type"] == "kma_weather"
    assert result["contract"]["requires_tool"] is True


def test_haruban_search_pool_contract_for_place_recommendation(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "제주시 맛집을 웹 출처로 비교했습니다.",
            "sources": [{"title": "지역 매체", "url": "https://example.com/jeju"}],
            "source_type": "web",
        },
    )

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "제주시 맛집 한 곳 추천해줘"}],
        {},
    )

    assert result["tool"] == "web_search_jeju"
    assert result["contract"]["answer_type"] == "fresh_web"
    assert result["contract"]["source_type"] == "web"


def test_haruban_search_pool_contract_for_web_search(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "answer": "이번 주 제주 축제는 웹 출처로 확인했습니다.",
            "sources": [{"title": "Visit Jeju", "url": "https://www.visitjeju.net/"}],
        },
    )

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "이번 주 제주 축제 알려줘"}],
        {},
    )

    assert result["tool"] == "web_search_jeju"
    assert result["contract"]["answer_type"] == "fresh_web"
    assert result["contract"]["source_type"] == "web"


def test_haruban_augment_runner_serializes_suggestions(monkeypatch):
    class FakeSuggestion:
        field = "moments"
        kind = "add"
        values = ["beach_walk"]
        labels = ["바다 산책"]
        reason = "성산에서 확인된 후보가 많습니다."
        counts = {"beach_walk": 4}

    class FakeResult:
        available = True
        suggestions = [FakeSuggestion()]
        llm_used = False
        reason = ""

    monkeypatch.setattr(haruban.augment_mod, "build_augment", lambda form_state: FakeResult())

    result = haruban._run_suggest_form_augment({"form_state": {"regions": ["seongsan"]}})

    assert result["suggestions"][0]["field"] == "moments"
    assert result["suggestions"][0]["values"] == ["beach_walk"]


def test_haruban_builds_pack_tool_pool_for_pack_request(monkeypatch):
    called = {}

    def fake_build_pack(args):
        called.update(args)
        return {"available": True, "sections": []}

    monkeypatch.setattr(haruban, "_run_build_pack", fake_build_pack)

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "이 조건으로 팩 만들어줘"}],
        {"regions": ["seongsan"], "moments": ["local_food"], "days": 2},
    )

    assert result["tool"] == "build_pack"
    assert called["form_state"]["regions"] == ["seongsan"]


def test_haruban_routes_review_question_to_verify_review(monkeypatch):
    monkeypatch.setattr(haruban, "_run_verify_review", lambda args: {"claims": []})

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "블로그에서 봤는데 이 리뷰 맞아? 성산 A는 폐업했다."}],
        {},
    )

    assert result["tool"] == "verify_review"


def test_haruban_routes_region_overview_question_to_web_search(monkeypatch):
    monkeypatch.setattr(
        haruban,
        "_run_web_search_jeju",
        lambda args: {
            "available": True,
            "query": args["query"],
            "answer": "제주시 가볼만한 곳은 웹 출처 기준으로 확인했습니다.",
            "sources": [{"title": "Visit Jeju", "url": "https://www.visitjeju.net/"}],
            "source_type": "web",
        },
    )

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "제주시의 가볼만한 곳들ㅇ느?"}],
        {},
    )

    assert result["tool"] == "web_search_jeju"
    assert result["result"]["sources"][0]["title"] == "Visit Jeju"
    assert "제주시" in result["args"]["query"]


def test_haruban_fallback_replies_from_build_pack_result():
    reply = haruban._fallback_reply_from_tool_messages([
        {
            "role": "tool",
            "name": "build_pack",
            "content": json.dumps({
                "available": True,
                "intro": {"text": "성산 현지 맛집 중심으로 조립했어요."},
                "sections": [
                    {
                        "moment": "local_food",
                        "items": [{"name": "소심한이층", "badge": "verified"}],
                        "fallback": None,
                    }
                ],
                "weather": {"summary": "바람 확인"},
            }, ensure_ascii=False),
        }
    ])

    assert "성산 현지 맛집" in reply
    assert "소심한이층" in reply
    assert "바람 확인" in reply


def test_haruban_fallback_replies_from_verify_review_result():
    reply = haruban._fallback_reply_from_tool_messages([
        {
            "role": "tool",
            "name": "verify_review",
            "content": json.dumps({
                "claims": [
                    {
                        "text": "A는 폐업했다.",
                        "verdict": "contradicted",
                        "fallback_reason": "contradicted",
                        "matched_name": "A",
                        "reason": "폐업 신호가 확인됩니다.",
                    }
                ],
            }, ensure_ascii=False),
        }
    ])

    assert "A는 폐업했다" in reply
    assert "폐업 신호" in reply
    assert "공공데이터 기준" in reply


def test_haruban_fallback_replies_from_region_coverage_result():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "제주시의 가볼만한 곳들ㅇ느?"},
        {
            "role": "tool",
            "name": "preview_region_coverage",
            "content": json.dumps({
                "regions": [
                    {
                        "region": "jeju_city",
                        "region_label": "제주시",
                        "briefing": "제주시는 바다 산책·현지 맛집 쪽 후보가 비교적 확인되어 있습니다.",
                    }
                ],
            }, ensure_ascii=False),
        },
    ])

    assert "제주시" in reply
    assert "바다 산책" in reply
    assert "현지 맛집" in reply
    assert "조건을 조금 더 확인" not in reply


def test_haruban_prepares_args_for_direct_unlocked_tool_calls():
    conv = [{"role": "user", "content": "블로그에서 봤는데 이 리뷰 맞아? 성산 A는 폐업했다."}]
    form_state = {"regions": ["seongsan"], "moments": ["local_food"], "days": 2}

    build_args = haruban._prepare_tool_args("build_pack", {}, conv, form_state)
    verify_args = haruban._prepare_tool_args("verify_review", {}, conv, form_state)
    coverage_args = haruban._prepare_tool_args("preview_region_coverage", {}, conv, form_state)
    augment_args = haruban._prepare_tool_args("suggest_form_augment", {}, conv, form_state)

    assert build_args["form_state"]["regions"] == ["seongsan"]
    assert verify_args["text"].startswith("블로그에서 봤는데")
    assert coverage_args["regions"] == ["seongsan"]
    assert augment_args["form_state"]["moments"] == ["local_food"]


def test_haruban_infers_visitjeju_expanded_categories():
    assert haruban._infer_category_from_text("한림 숙박시설 알려줘") == "accommodation"
    assert haruban._infer_category_from_text("이번 여행 기간 축제 행사 알려줘") == "festival"
    assert haruban._infer_category_from_text("비 오는 날 실내 전시 알려줘") == "culture"
    assert haruban._infer_category_from_text("기념품 쇼핑 알려줘") == "shopping"
    assert haruban._infer_category_from_text("감귤 체험 알려줘") == "experience"


def test_haruban_fallback_reply_from_search_tool_is_user_facing():
    reply = haruban._fallback_reply_from_tool_messages([
        {
            "role": "tool",
            "name": "search_places",
            "content": json.dumps({
                "total_count": 3,
                "regions": ["hallim"],
                "category": "place",
                "items": [
                    {"name": "금오름", "address": "제주시 한림읍"},
                    {"name": "느지리오름", "address": "제주시 한림읍"},
                ],
            }, ensure_ascii=False),
        }
    ])

    assert "한림" in reply
    assert "3곳" in reply
    assert "금오름" in reply
    assert "공공데이터 기준" in reply
    assert "DB/RAG" not in reply


def test_haruban_fallback_recommends_one_place_when_user_asks_for_one():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "2박3일 일정인데 성산에서는 점심을 먹을 예정이야, 한곳을 추천해준다면?"},
        {
            "role": "tool",
            "name": "search_places",
            "content": json.dumps({
                "intent": "recommend",
                "total_count": 77,
                "regions": ["seongsan"],
                "category": "food",
                "items": [
                    {
                        "name": "WORLD CLASS FISH&CHIPS",
                        "address": "제주특별자치도 서귀포시 성산읍",
                        "has_fix_request": False,
                    },
                    {
                        "name": "소심한이층",
                        "address": "제주특별자치도 서귀포시 성산읍",
                        "has_fix_request": False,
                    },
                ],
            }, ensure_ascii=False),
        },
    ])

    assert "한 곳만" in reply
    assert "WORLD CLASS FISH&CHIPS" in reply
    assert "77곳" in reply
    assert "더 좁혀드릴까요" not in reply


def test_haruban_fallback_answers_place_detail_from_detail_tool():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "소심한 이층에 관해 자세히 알려줘"},
        {
            "role": "tool",
            "name": "get_place_detail",
            "content": json.dumps({
                "query": "소심한 이층",
                "items": [
                    {
                        "name": "소심한이층",
                        "region": "seongsan",
                        "category": "food",
                        "address": "제주특별자치도 서귀포시 성산읍",
                        "source": "비짓제주",
                        "has_fix_request": False,
                        "check_required": ["operating", "public_data"],
                    }
                ],
            }, ensure_ascii=False),
        },
    ])

    assert "소심한이층" in reply
    assert "성산" in reply
    assert "주소" in reply
    assert "영업시간" in reply
    assert "공공데이터 기준" in reply


def test_haruban_infers_detail_query_from_spaced_place_name():
    conv = [
        {
            "role": "assistant",
            "content": "먼저 해오름, WORLD CLASS FISH&CHIPS, 소심한이층 같은 후보를 볼 수 있어요.",
        },
        {"role": "user", "content": "소심한 이층에 관해 자세히 알려줘"},
    ]

    assert haruban._infer_place_detail_query(conv) == "소심한이층"


def test_haruban_builds_search_pool_args_for_one_seafood_lunch():
    conv = [
        {"role": "user", "content": "2박3일 일정인데 성산에서는 점심을 먹을 예정이야, 한곳을 추천해준다면?"},
        {"role": "assistant", "content": "조건을 조금 더 알려주세요."},
        {"role": "user", "content": "혼자이고 제주도에서 먹을 수 있는 해산물이면 좋겠어"},
    ]
    args = haruban._infer_search_places_args(conv, {
        "regions": ["seongsan"],
        "moments": ["local_food"],
        "companion": "solo",
    })

    assert args["regions"] == ["seongsan"]
    assert args["category"] == "food"
    assert args["intent"] == "recommend"
    assert args["limit"] == 1
    assert "해산물" in args["keywords"]


def test_haruban_one_pick_request_overrides_previous_three_count():
    conv = [
        {"role": "user", "content": "성산의 맛집들을 3곳을 알려줘"},
        {"role": "assistant", "content": "먼저 해오름, WORLD CLASS FISH&CHIPS, 소심한이층 같은 후보를 볼 수 있어요."},
        {"role": "user", "content": "2박3일 일정인데 성산에서는 점심을 먹을 예정이야, 한곳을 추천해준다면?"},
    ]

    args = haruban._infer_search_places_args(conv, {})

    assert args["regions"] == ["seongsan"]
    assert args["category"] == "food"
    assert args["intent"] == "recommend"
    assert args["limit"] == 1


def test_haruban_detects_detail_query_from_plain_previous_candidate_list():
    conv = [
        {"role": "assistant", "content": "해오름, WORLD CLASS FISH&CHIPS, 소심한이층 후보가 있어요."},
        {"role": "user", "content": "소심한 이층에 관해 자세히 알려줘"},
    ]

    assert haruban._infer_place_detail_query(conv) == "소심한이층"


def test_haruban_does_not_treat_general_planning_as_place_detail():
    conv = [
        {"role": "user", "content": "제주는 처음인데 어떻게 여행계획을 세우면 좋을지 알려줘"},
    ]

    assert haruban._infer_place_detail_query(conv) == ""
    assert haruban._build_search_pool_context(conv, {}) is None


def test_haruban_does_not_treat_region_category_query_as_place_detail():
    conv = [
        {"role": "user", "content": "제주시에 있는 오름 정보를 알려줘"},
    ]

    assert haruban._infer_place_detail_query(conv) == ""
    args = haruban._infer_search_places_args(conv, {})
    assert args["regions"] == ["jeju_city"]
    assert args["category"] == "oreum"


def test_haruban_infers_beach_category_from_user_text():
    conv = [
        {"role": "user", "content": "제주시에 있는 바닷가 알려줘"},
    ]

    assert haruban._infer_place_detail_query(conv) == ""
    args = haruban._infer_search_places_args(conv, {})
    assert args["regions"] == ["jeju_city"]
    assert args["category"] == "beach"


def test_haruban_routes_broad_advice_to_free_gpt_path():
    assert haruban._should_answer_without_search([
        {"role": "user", "content": "제주는 처음인데 어떻게 여행계획을 세우면 좋을지 알려줘"},
    ])
    assert haruban._should_answer_without_search([
        {"role": "user", "content": "제주시는 어떤곳을 가보면 좋은지 알려줘"},
    ])
    assert not haruban._should_answer_without_search([
        {"role": "user", "content": "제주시에 있는 오름 정보를 알려줘"},
    ])
    assert not haruban._should_answer_without_search([
        {"role": "user", "content": "소심한이층에 관해 자세히 알려줘"},
    ])


def test_haruban_extracts_previous_candidates_for_more_requests():
    conv = [
        {
            "role": "assistant",
            "content": (
                "제주시에서 현지 맛집 후보는 공공데이터 기준으로 493곳 확인됩니다. "
                "먼저 용담밭담, 시나르, 다인숯불갈비 같은 후보를 볼 수 있어요."
            ),
        },
        {"role": "user", "content": "3곳 이외에 3곳 더 알려줘"},
    ]

    assert haruban._conversation_exclude_names(conv) == [
        "용담밭담",
        "시나르",
        "다인숯불갈비",
    ]


def test_haruban_extracts_explicit_exclusions():
    conv = [
        {
            "role": "assistant",
            "content": "먼저 다인숯불갈비, 고집돌우럭 (제주공항점), 용담밭담 같은 후보를 볼 수 있어요.",
        },
        {"role": "user", "content": "다인숯불갈비, 용담밭담은 제외하고 3곳을 더 알려줘"},
    ]

    assert haruban._conversation_exclude_names(conv) == [
        "다인숯불갈비",
        "고집돌우럭 (제주공항점)",
        "용담밭담",
    ]


def test_haruban_fallback_answers_repetition_question():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "다인 숯불갈비는 왜 반복적으로 알려주는거야?"},
    ])

    assert "이전 후보" in reply
    assert "제외" in reply
    assert "다시" in reply


def test_haruban_fallback_mentions_excluded_candidates():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "다인숯불갈비, 용담밭담은 제외하고 3곳 더 알려줘"},
        {
            "role": "tool",
            "name": "search_places",
            "content": json.dumps({
                "intent": "list",
                "total_count": 493,
                "regions": ["jeju_city"],
                "category": "food",
                "excluded_names": ["다인숯불갈비", "용담밭담"],
                "items": [
                    {"name": "명당양과", "address": "제주시"},
                    {"name": "제주올레면옥 제주공항본점", "address": "제주시"},
                    {"name": "해오름", "address": "제주시"},
                ],
            }, ensure_ascii=False),
        },
    ])

    assert "다인숯불갈비" in reply
    assert "용담밭담" in reply
    assert "빼고" in reply
    assert "명당양과" in reply
    assert "더 좁혀드릴까요" not in reply


def test_haruban_routes_fix_request_question_to_place_detail():
    conv = [{"role": "user", "content": "느지리오름 수정요청내역은 어떤거야?"}]

    assert haruban._infer_place_detail_query(conv) == "느지리오름"


def test_haruban_fallback_answers_fix_request_detail_honestly():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "느지리오름 수정요청내역은 어떤거야?"},
        {
            "role": "tool",
            "name": "get_place_detail",
            "content": json.dumps({
                "query": "느지리오름",
                "items": [
                    {
                        "name": "느지리오름",
                        "region_label": "한림",
                        "category_label": "오름 산책",
                        "has_fix_request": True,
                        "fix_request": {
                            "status": "확인 필요",
                            "summary": "이용자 정보 수정요청 이력이 있어 방문 전 재확인이 필요한 후보입니다.",
                            "known_detail": "현재 연결된 공공데이터에는 수정요청의 세부 사유가 별도 필드로 분리되어 있지 않습니다.",
                            "check_items": ["운영시간", "주소/위치", "휴무·폐업 여부", "이동·주차 가능 여부"],
                        },
                    }
                ],
            }, ensure_ascii=False),
        },
    ])

    assert "느지리오름" in reply
    assert "수정요청 이력" in reply
    assert "세부 사유" in reply
    assert "운영시간" in reply
    assert "후보는 공공데이터 기준" not in reply


def test_haruban_fallback_answers_transit_detail_from_place_detail():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "금능포구 주차장이나 정류소는 어때?"},
        {
            "role": "tool",
            "name": "get_place_detail",
            "content": json.dumps({
                "query": "금능포구",
                "items": [
                    {
                        "name": "금능포구",
                        "region_label": "한림",
                        "category_label": "바다 산책",
                        "address": "제주시 한림읍",
                        "has_fix_request": False,
                        "transit": {
                            "parking": True,
                            "parking_count": 2,
                            "bus_walkable": True,
                            "parking_radius_km": 1.0,
                            "busstop_radius_km": 0.5,
                        },
                    }
                ],
            }, ensure_ascii=False),
        },
    ])

    assert "금능포구" in reply
    assert "주차장 2곳" in reply
    assert "정류소" in reply
    assert "좌표 기준" in reply


def test_haruban_infers_transit_place_name_with_particles():
    assert haruban._infer_place_detail_query([
        {"role": "user", "content": "후포해변의 교통편을 알려줘"},
    ]) == "후포해변"
    assert haruban._infer_place_detail_query([
        {"role": "user", "content": "돔베낭길의 주차장이 있어?"},
    ]) == "돔베낭길"
    assert haruban._infer_place_detail_query([
        {"role": "user", "content": "금능포구 주차장이나 정류소는 어때?"},
    ]) == "금능포구"


def test_haruban_detail_query_does_not_inherit_form_moment_category(monkeypatch):
    captured = {}

    def fake_detail(args):
        captured.update(args)
        return {"query": args["query"], "items": []}

    monkeypatch.setattr(haruban, "_run_get_place_detail", fake_detail)

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "돔베낭길의 주차장이 있어?"}],
        {"regions": ["seogwipo"], "moments": ["climb_oreum"]},
    )

    assert result["tool"] == "get_place_detail"
    assert captured["query"] == "돔베낭길"
    assert captured["regions"] == ["seogwipo"]
    assert "category" not in captured


def test_haruban_fallback_answers_weather_signal_by_trip_days():
    reply = haruban._fallback_reply_from_tool_messages([
        {"role": "user", "content": "여행 기간 날씨는 어때?"},
        {
            "role": "tool",
            "name": "weather_signal",
            "content": json.dumps({
                "region_label": "한림",
                "available": True,
                "labels": ["흐림", "바람 확인"],
                "daily_forecasts": [
                    {
                        "date_label": "7월 10일",
                        "forecast": {
                            "sky": "흐림",
                            "precipitation_probability": 30,
                            "temperature": 28,
                            "wind_speed": 4.8,
                        },
                    },
                    {
                        "date_label": "7월 11일",
                        "forecast": {
                            "sky": "맑음",
                            "precipitation_probability": 0,
                            "temperature": 29,
                            "wind_speed": 2.0,
                        },
                    },
                ],
            }, ensure_ascii=False),
        },
    ])

    assert "한림" in reply
    assert "7월 10일" in reply
    assert "강수확률 30%" in reply
    assert "풍속 4.8m/s" in reply
